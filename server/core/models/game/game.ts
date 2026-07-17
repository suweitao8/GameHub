import { isGameStatusValid } from '@server/helpers/custom-validators/games.js'
import type { GameStatus, MGame } from '@server/types/models/game/game.js'
import { Op } from 'sequelize'
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
import { VideoModel } from '../video/video.js'

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

  @AllowNull(true)
  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: { allowNull: true },
    onDelete: 'SET NULL'
  })
  declare Video: Awaited<VideoModel>

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

  static listPublished (options: { category?: string; search?: string; sort?: string; limit: number; offset: number }) {
    const where: any = { status: 'published' }

    if (options.category) where.category = options.category
    if (options.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${options.search}%` } },
        { description: { [Op.iLike]: `%${options.search}%` } },
        { tags: { [Op.contains]: [ options.search ] } }
      ]
    }

    const order = options.sort === 'popular'
      ? [ [ 'playCount', 'DESC' ], [ 'publishedAt', 'DESC' ] ]
      : [ [ 'publishedAt', 'DESC' ], [ 'createdAt', 'DESC' ] ]

    return Promise.all([
      GameModel.count({ where }),
      GameModel.findAll<MGame>({
        where,
        include: [ { model: AccountModel, required: true } ],
        order: order as any,
        limit: options.limit,
        offset: options.offset
      })
    ]).then(([ total, data ]) => ({ total, data }))
  }
}
