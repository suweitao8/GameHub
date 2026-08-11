import { isGameStatusValid } from '@server/helpers/custom-validators/games.js'
import type { GameStatus, MGame } from '@server/types/models/game/game.js'
import { col, fn, literal, Op } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasOne,
  Is,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { GameStatsSummaryModel } from './game-stats-summary.js'
import { SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { getGameSortMetric } from '@server/lib/games/game-query.js'
import { extractScoreInput, mergeWithPersonalization, scoreGameForRecommendation } from '@server/lib/games/game-recommendation-score.js'
import { getRecommendedGames } from '@server/lib/games/game-recommendations.js'

@Table({
  tableName: 'game',
  indexes: [
    { fields: [ 'uuid' ], unique: true },
    { fields: [ 'status', 'publishedAt' ] },
    { fields: [ 'status', 'featured', 'featuredAt' ] },
    { fields: [ 'status', 'playCount' ] },
    { fields: [ 'status', 'category', 'publishedAt' ] },
    { fields: [ 'ownerAccountId', 'createdAt' ] },
    { fields: [ 'category' ] },
    { fields: [ 'title' ], using: 'gin', operator: 'gin_trgm_ops' }
  ]
})
export class GameModel extends SequelizeModel<GameModel> {
  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare uuid: string

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare ownerAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: { allowNull: false },
    onDelete: 'CASCADE'
  })
  declare Owner: Awaited<AccountModel>

  @HasOne(() => GameStatsSummaryModel, { foreignKey: 'gameId' })
  declare StatsSummary: Awaited<GameStatsSummaryModel> | null

  @AllowNull(false)
  @Is('GameTitle', value => throwIfNotValid(value, value => typeof value === 'string' && value.length >= 1 && value.length <= 120, 'title'))
  @Column(DataType.STRING(120))
  declare title: string

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare instructions: string

  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare category: string

  @AllowNull(false)
  @Column(DataType.ARRAY(DataType.TEXT))
  declare tags: string[]

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare coverPath: string

  @AllowNull(false)
  @Default([])
  @Column(DataType.ARRAY(DataType.TEXT))
  declare screenshotPaths: string[]

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare runtimePath: string

  @AllowNull(false)
  @Column(DataType.CHAR(64))
  declare runtimeSha256: string

  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare fileSizeBytes: number

  @AllowNull(false)
  @Is('GameStatus', value => throwIfNotValid(value, isGameStatusValid, 'status'))
  @Column(DataType.STRING(32))
  declare status: GameStatus

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare moderationReason: string

  @AllowNull(true)
  @ForeignKey(() => AccountModel)
  @Column
  declare moderatedByAccountId: number

  @AllowNull(true)
  @Column
  declare moderatedAt: Date

  @AllowNull(false)
  @Default(0)
  @Column
  declare playCount: number

  @AllowNull(true)
  @Column
  declare publishedAt: Date

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare featured: boolean

  @AllowNull(true)
  @Column(DataType.DATE)
  declare featuredAt: Date | null

  @AllowNull(true)
  @Column(DataType.DATE)
  declare releaseDate: Date | null

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  static loadByUUID (uuid: string, options: { publishedOnly?: boolean, includeStats?: boolean } = {}) {
    const where: any = { uuid }
    if (options.publishedOnly) where.status = 'published'

    const include = [ { model: AccountModel, required: true } ] as any[]
    if (options.includeStats) include.push({ model: GameStatsSummaryModel, required: false })

    return GameModel.findOne<MGame>({ where, include })
  }

  static async listPublished (options: {
    category?: string
    search?: string
    publishedAfter?: string
    device?: string
    ownerAccountIds?: number[]
    sort?: string
    limit: number
    offset: number
  }) {
    const where: any = { status: 'published' }

    if (options.category) where.category = options.category
    if (options.publishedAfter) where.publishedAt = { [Op.gte]: new Date(options.publishedAfter) }
    if (options.device) where.tags = { [Op.contains]: [ options.device ] }
    if (options.ownerAccountIds) where.ownerAccountId = { [Op.in]: options.ownerAccountIds }
    if (options.search) {
      const search = options.search
      const escapedSearch = search.replace(/'/g, "''")

      // Use pg_trgm % operator for index-accelerated matching on title
      // and ILIKE fallback for description/category which lack trgm indexes
      const ownerIds = await AccountModel.findAll({
        attributes: [ 'id' ],
        where: { name: { [Op.iLike]: `%${search}%` } }
      }).then(accounts => accounts.map(account => account.id))

      where[Op.or] = [
        literal(`"GameModel"."title" % '${escapedSearch}'`),
        { description: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
        { tags: { [Op.contains]: [ search ] } }
      ]
      if (ownerIds.length > 0) where[Op.or].push({ ownerAccountId: { [Op.in]: ownerIds } })
    }

    const metric = getGameSortMetric(options.sort)
    const statsCol = (field: string) => col(`StatsSummary.${field}`)

    // When searching, sort by similarity score first, then by popularity
    const isSearch = !!options.search
    const order = isSearch
      ? [
          [ fn('GREATEST', literal(`similarity("GameModel"."title", '${options.search.replace(/'/g, "''")}')`), literal(`similarity("GameModel"."description", '${options.search.replace(/'/g, "''")}')`)), 'DESC' ],
          [ 'playCount', 'DESC' ],
          [ 'publishedAt', 'DESC' ]
        ]
      : metric === 'plays'
        ? [ [ 'playCount', 'DESC' ], [ 'publishedAt', 'DESC' ] ]
        : metric === 'latest' || metric === 'recommended'
          ? [ [ 'publishedAt', 'DESC' ], [ 'createdAt', 'DESC' ] ]
          : metric === 'updated'
            ? [ [ 'updatedAt', 'DESC' ], [ 'publishedAt', 'DESC' ] ]
            : [ [ statsCol(metric), 'DESC' ], [ 'publishedAt', 'DESC' ] ]

    return Promise.all([
      GameModel.count({ where }),
      GameModel.findAll<MGame>({
        subQuery: false,
        where,
        attributes: { include: GameModel.getPublicStatsAttributes() },
        include: [
          { model: AccountModel, required: true },
          { model: GameStatsSummaryModel, required: false, attributes: [] }
        ],
        order: order as any,
        limit: options.limit,
        offset: options.offset
      })
    ]).then(([ total, data ]) => ({ total, data }))
  }

  /**
   * 多因子推荐列表：DB 粗排取候选 → JS 精排打分 → 登录用户叠加 CF 个性化。
   *
   * 与 listPublished 的区别：
   * - 不走单一指标 ORDER BY，而是用多因子热度分（播放量+质量+收藏+投币+精选+时间衰减）重排
   * - 登录用户额外融合协同过滤结果，游客走纯全局热度
   * - CF 为空（新用户冷启动）时无缝回退到全局热度
   *
   * 策略：DB 取 limit*5 候选（playCount 粗排）保证覆盖面，JS 层精排后截断到 offset+limit。
   */
  static async listRecommended (options: {
    accountId?: number
    category?: string
    search?: string
    publishedAfter?: string
    device?: string
    ownerAccountIds?: number[]
    limit: number
    offset: number
  }) {
    const { accountId, category, search, publishedAfter, device, ownerAccountIds, limit, offset } = options

    // 搜索场景下语义推荐没有意义，回退到 listPublished 的相似度排序
    if (search) {
      return GameModel.listPublished({ category, search, publishedAfter, device, ownerAccountIds, sort: 'recommended', limit, offset })
    }

    const where: any = { status: 'published' }
    if (category) where.category = category
    if (publishedAfter) where.publishedAt = { [Op.gte]: new Date(publishedAfter) }
    if (device) where.tags = { [Op.contains]: [ device ] }
    if (ownerAccountIds) where.ownerAccountId = { [Op.in]: ownerAccountIds }

    // DB 粗排：取足量候选，保证精排后有足够样本覆盖 offset+limit
    const candidateLimit = Math.min(200, Math.max(limit * 5, 20))
    const candidates = await GameModel.findAll<MGame>({
      subQuery: false,
      where,
      attributes: { include: GameModel.getPublicStatsAttributes() },
      include: [
        { model: AccountModel, required: true },
        { model: GameStatsSummaryModel, required: false, attributes: [] }
      ],
      order: [ [ 'playCount', 'DESC' ], [ 'publishedAt', 'DESC' ] ],
      limit: candidateLimit
    })

    // JS 精排：多因子打分
    const now = new Date()
    const scored = candidates
      .map(game => ({
        game,
        score: scoreGameForRecommendation(extractScoreInput(game), now)
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.game)

    // 登录用户：融合 CF 个性化结果（CF 为空时 mergeWithPersonalization 自动回退到全局）
    let finalGames = scored
    if (accountId) {
      const cfResult = await getRecommendedGames({ accountId, limit: candidateLimit })
      const cfGames = cfResult.data
      if (cfGames.length > 0) {
        finalGames = mergeWithPersonalization(scored, cfGames)
      }
    }

    // 截断到请求的分页窗口
    const paged = finalGames.slice(offset, offset + limit)
    return { total: finalGames.length, data: paged }
  }

  /**
   * 从 GameStatsSummaryModel JOIN 读取聚合统计，替代每行子查询
   * 必须配合 include: [ GameStatsSummaryModel ] 使用
   */
  static getPublicStatsAttributes (statsAlias = 'StatsSummary') {
    const statsColumn = (field: string) => literal(`"${statsAlias}"."${field}"`)

    return [
      [ statsColumn('likes'), 'gameLikes' ],
      [ statsColumn('dislikes'), 'gameDislikes' ],
      [ statsColumn('comments'), 'gameComments' ],
      [ statsColumn('favorites'), 'favoriteCount' ],
      [ statsColumn('coins'), 'coinCount' ]
    ] as any
  }
}
