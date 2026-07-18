import { isGameStatusValid } from '@server/helpers/custom-validators/games.js'
import type { GameStatus, MGame } from '@server/types/models/game/game.js'
import { literal, Op } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Is,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { getGameSortMetric } from '@server/lib/games/game-query.js'

@Table({
  tableName: 'game',
  indexes: [
    { fields: [ 'uuid' ], unique: true },
    { fields: [ 'status', { name: 'publishedAt', order: 'DESC' } ] },
    { fields: [ 'ownerAccountId', { name: 'createdAt', order: 'DESC' } ] },
    { fields: [ 'category' ] }
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
      const ownerIds = await AccountModel.findAll({
        attributes: [ 'id' ],
        where: { name: { [Op.iLike]: `%${options.search}%` } }
      }).then(accounts => accounts.map(account => account.id))

      where[Op.or] = [
        { title: { [Op.iLike]: `%${options.search}%` } },
        { description: { [Op.iLike]: `%${options.search}%` } },
        { category: { [Op.iLike]: `%${options.search}%` } },
        { tags: { [Op.contains]: [ options.search ] } }
      ]
      if (ownerIds.length > 0) where[Op.or].push({ ownerAccountId: { [Op.in]: ownerIds } })
    }

    const metric = getGameSortMetric(options.sort)
    const aggregateOrder = {
      likes: literal('(SELECT COUNT(*) FROM "gameRating" WHERE "gameRating"."gameId" = "GameModel"."id" AND "gameRating"."type" = \'like\')'),
      coins: literal('(SELECT COALESCE(SUM("amount" * -1), 0) FROM "gameCoinLedger" WHERE "gameCoinLedger"."gameId" = "GameModel"."id" AND "gameCoinLedger"."kind" = \'spend\')'),
      favorites: literal('(SELECT COUNT(*) FROM "gameFavorite" WHERE "gameFavorite"."gameId" = "GameModel"."id")')
    }
    const order = metric === 'plays'
      ? [ [ 'playCount', 'DESC' ], [ 'publishedAt', 'DESC' ] ]
      : metric === 'latest' || metric === 'recommended'
        ? [ [ 'publishedAt', 'DESC' ], [ 'createdAt', 'DESC' ] ]
        : [ [ aggregateOrder[metric], 'DESC' ], [ 'publishedAt', 'DESC' ] ]

    return Promise.all([
      GameModel.count({ where }),
      GameModel.findAll<MGame>({
        where,
        attributes: { include: GameModel.getPublicStatsAttributes() },
        include: [ { model: AccountModel, required: true } ],
        order: order as any,
        limit: options.limit,
        offset: options.offset
      })
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static getPublicStatsAttributes (tableAlias = '"GameModel"') {
    const gameId = `${tableAlias}."id"`

    return [
      [ literal(`(SELECT COUNT(*) FROM "gameRating" WHERE "gameRating"."gameId" = ${gameId} AND "gameRating"."type" = 'like')`), 'gameLikes' ],
      [ literal(`(SELECT COUNT(*) FROM "gameRating" WHERE "gameRating"."gameId" = ${gameId} AND "gameRating"."type" = 'dislike')`), 'gameDislikes' ],
      [ literal(`(SELECT COUNT(*) FROM "gameComment" WHERE "gameComment"."gameId" = ${gameId} AND "gameComment"."deletedAt" IS NULL)`), 'gameComments' ],
      [ literal(`(SELECT COUNT(*) FROM "gameFavorite" WHERE "gameFavorite"."gameId" = ${gameId})`), 'favoriteCount' ],
      [ literal(`(SELECT COALESCE(SUM("amount" * -1), 0) FROM "gameCoinLedger" WHERE "gameCoinLedger"."gameId" = ${gameId} AND "gameCoinLedger"."kind" = 'spend')`), 'coinCount' ]
    ] as any
  }
}
