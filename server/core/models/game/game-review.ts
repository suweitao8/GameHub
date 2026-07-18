import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

@Table({
  tableName: 'gameReview',
  indexes: [
    { fields: [ 'gameId', 'accountId' ], unique: true },
    { fields: [ 'gameId', 'createdAt' ] },
    { fields: [ 'accountId' ] }
  ]
})
export class GameReviewModel extends SequelizeModel<GameReviewModel> {
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

  @AllowNull(false)
  @Column(DataType.SMALLINT)
  declare score: number

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare text: string

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
