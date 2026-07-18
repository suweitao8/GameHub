import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameCommentModel } from './game-comment.js'

@Table({
  tableName: 'gameCommentReaction',
  indexes: [
    { fields: [ 'commentId', 'accountId' ], unique: true },
    { fields: [ 'commentId' ] },
    { fields: [ 'accountId' ] }
  ]
})
export class GameCommentReactionModel extends SequelizeModel<GameCommentReactionModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => GameCommentModel)
  @Column
  declare commentId: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => GameCommentModel, { foreignKey: 'commentId', onDelete: 'CASCADE' })
  declare Comment: Awaited<GameCommentModel>

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
