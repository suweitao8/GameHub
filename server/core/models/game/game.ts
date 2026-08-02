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

  static loadByUUID (uuid: string, options: { publishedOnly?: boolean } = {}) {
    const where: any = { uuid }
    if (options.publishedOnly) where.status = 'published'

    return GameModel.findOne<MGame>({ where, include: [ { model: AccountModel, required: true } ] })
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
   * 从 GameStatsSummaryModel JOIN 读取聚合统计，替代每行子查询
   * 必须配合 include: [ GameStatsSummaryModel ] 使用
   */
  static getPublicStatsAttributes (_tableAlias = '"GameModel"') {
    return [
      [ col('StatsSummary.likes'), 'gameLikes' ],
      [ col('StatsSummary.dislikes'), 'gameDislikes' ],
      [ col('StatsSummary.comments'), 'gameComments' ],
      [ col('StatsSummary.favorites'), 'favoriteCount' ],
      [ col('StatsSummary.coins'), 'coinCount' ]
    ] as any
  }
}
