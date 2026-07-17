import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { VideoCommentModel } from '../video/video-comment.js'

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
  @ForeignKey(() => VideoCommentModel)
  @Column
  declare commentId: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => VideoCommentModel, { foreignKey: 'commentId', onDelete: 'CASCADE' })
  declare Comment: Awaited<VideoCommentModel>

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
