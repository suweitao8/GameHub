import { Transaction } from 'sequelize'
import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

export type GameRatingType = 'like' | 'dislike'

@Table({
  tableName: 'gameRating',
  indexes: [
    { fields: [ 'gameId', 'accountId' ], unique: true },
    { fields: [ 'gameId', 'type' ] },
    { fields: [ 'accountId' ] }
  ]
})
export class GameRatingModel extends SequelizeModel<GameRatingModel> {
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
  @Column(DataType.STRING(16))
  declare type: GameRatingType

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  static load (accountId: number, gameId: number, transaction?: Transaction) {
    return GameRatingModel.findOne({ where: { accountId, gameId }, transaction })
  }
}
