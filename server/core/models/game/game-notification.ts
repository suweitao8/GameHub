import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import type { GameNotificationKind } from '@server/lib/games/game-notifications.js'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

@Table({
  tableName: 'gameNotification',
  indexes: [
    { fields: [ 'recipientAccountId', { name: 'createdAt', order: 'DESC' } ] },
    { fields: [ 'recipientAccountId', 'readAt' ] }
  ]
})
export class GameNotificationModel extends SequelizeModel<GameNotificationModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare recipientAccountId: number

  @AllowNull(true)
  @ForeignKey(() => AccountModel)
  @Column
  declare actorAccountId: number | null

  @AllowNull(true)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number | null

  @AllowNull(false)
  @Column(DataType.STRING(32))
  declare kind: GameNotificationKind

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare message: string

  @AllowNull(true)
  @Column(DataType.DATE)
  declare readAt: Date | null

  @BelongsTo(() => AccountModel, { foreignKey: 'recipientAccountId', onDelete: 'CASCADE' })
  declare Recipient: Awaited<AccountModel>

  @BelongsTo(() => AccountModel, { foreignKey: 'actorAccountId', as: 'Actor', onDelete: 'SET NULL' })
  declare Actor: Awaited<AccountModel>

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'SET NULL' })
  declare Game: Awaited<GameModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
