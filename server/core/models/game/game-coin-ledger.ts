import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

@Table({
  tableName: 'gameCoinLedger',
  indexes: [
    { fields: [ 'accountId', 'day', 'kind' ], unique: true, where: { kind: 'daily_grant' } },
    { fields: [ 'accountId' ] },
    { fields: [ 'gameId', 'accountId' ] }
  ]
})
export class GameCoinLedgerModel extends SequelizeModel<GameCoinLedgerModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @AllowNull(true)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number | null

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare amount: number

  @AllowNull(false)
  @Column(DataType.STRING(32))
  declare kind: 'daily_grant' | 'spend'

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare day: string

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @CreatedAt
  declare createdAt: Date
}
