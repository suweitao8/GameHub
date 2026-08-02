import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { GameModel } from './game.js'
import { SequelizeModel } from '../shared/index.js'

export type GameActivityKind = 'publish' | 'comment' | 'reply' | 'like' | 'favorite' | 'coin' | 'follow'

/**
 * 社区动态 — 记录游戏相关的所有用户活动
 * 用于构建关注动态 Feed
 */
@Table({
  tableName: 'gameActivity',
  indexes: [
    { fields: [ 'actorAccountId', 'createdAt' ] },
    { fields: [ 'gameId', 'createdAt' ] },
    { fields: [ 'kind', 'createdAt' ] }
  ]
})
export class GameActivityModel extends SequelizeModel<GameActivityModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare actorAccountId: number

  @AllowNull(true)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number | null

  @AllowNull(false)
  @Default('publish')
  @Column(DataType.STRING(32))
  declare kind: GameActivityKind

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare message: string

  @BelongsTo(() => AccountModel, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' })
  declare Actor: Awaited<AccountModel>

  @BelongsTo(() => GameModel, { foreignKey: { allowNull: true }, onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel> | null

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  /**
   * 创建活动记录（幂等，同一游戏同一类型只保留最新一条）
   */
  static async createActivity (options: {
    actorAccountId: number
    gameId: number | null
    kind: GameActivityKind
    message: string
  }): Promise<GameActivityModel> {
    // 对于 publish 类型，同一游戏只保留最新一条
    if (options.kind === 'publish' && options.gameId) {
      const existing = await GameActivityModel.findOne({
        where: { actorAccountId: options.actorAccountId, gameId: options.gameId, kind: 'publish' }
      })
      if (existing) {
        existing.message = options.message
        existing.createdAt = new Date()
        return existing.save()
      }
    }

    return GameActivityModel.create(options)
  }
}
