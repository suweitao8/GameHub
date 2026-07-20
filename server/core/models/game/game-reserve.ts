import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { GameModel } from './game.js'
import { SequelizeModel } from '../shared/index.js'

@Table({
  tableName: 'gameReserve',
  indexes: [
    { fields: [ 'gameId', 'accountId' ], unique: true },
    { fields: [ 'accountId', 'createdAt' ] },
    { fields: [ 'gameId' ] }
  ]
})
export class GameReserveModel extends SequelizeModel<GameReserveModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare notified: boolean

  @BelongsTo(() => GameModel, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @BelongsTo(() => AccountModel, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
