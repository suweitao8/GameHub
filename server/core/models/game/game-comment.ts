import { AllowNull, AutoIncrement, BelongsTo, Column, DataType, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

@Table({
  tableName: 'gameComment',
  indexes: [
    { fields: [ 'gameId', 'createdAt' ] },
    { fields: [ 'gameId', 'inReplyToCommentId' ] },
    { fields: [ 'gameId', 'deletedAt' ] },
    { fields: [ 'accountId', 'createdAt' ] },
    { fields: [ 'accountId' ] }
  ]
})
export class GameCommentModel extends SequelizeModel<GameCommentModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number

  @AllowNull(true)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number | null

  @AllowNull(true)
  @ForeignKey(() => GameCommentModel)
  @Column
  declare inReplyToCommentId: number | null

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare text: string

  @AllowNull(true)
  @Column(DataType.DATE)
  declare deletedAt: Date | null

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'SET NULL' })
  declare Account: Awaited<AccountModel> | null

  @BelongsTo(() => GameCommentModel, { foreignKey: 'inReplyToCommentId', as: 'Parent', onDelete: 'CASCADE' })
  declare Parent: Awaited<GameCommentModel> | null

  isDeleted () {
    return this.deletedAt !== null
  }

  toFormattedJSON (options: { totalReplies?: number } = {}) {
    return {
      id: this.id,
      url: null,
      text: this.text,
      threadId: this.inReplyToCommentId || this.id,
      inReplyToCommentId: this.inReplyToCommentId,
      gameId: this.gameId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      heldForReview: false,
      isDeleted: this.isDeleted(),
      totalRepliesFromVideoAuthor: 0,
      totalReplies: options.totalReplies || 0,
      account: this.Account?.toFormattedJSON() || null
    }
  }
}
