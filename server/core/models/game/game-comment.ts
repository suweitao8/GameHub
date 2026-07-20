import { AllowNull, AutoIncrement, BelongsTo, Column, DataType, Default, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

// 精选评论的最低点赞数阈值
export const FEATURED_COMMENT_LIKE_THRESHOLD = 10

@Table({
  tableName: 'gameComment',
  indexes: [
    { fields: [ 'gameId', 'createdAt' ] },
    { fields: [ 'gameId', 'inReplyToCommentId' ] },
    { fields: [ 'gameId', 'deletedAt' ] },
    { fields: [ 'accountId', 'createdAt' ] },
    { fields: [ 'accountId' ] },
    { fields: [ 'gameId', 'likeCount' ] },
    { fields: [ 'gameId', 'isFeatured', 'createdAt' ] }
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

  @Default(0)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare likeCount: number

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare isFeatured: boolean

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'SET NULL' })
  declare Account: Awaited<AccountModel> | null

  @BelongsTo(() => GameCommentModel, { foreignKey: 'inReplyToCommentId', as: 'Parent', onDelete: 'CASCADE' })
  declare Parent: Awaited<GameCommentModel> | null

  isDeleted () {
    return this.deletedAt !== null
  }

  /**
   * 根据点赞数更新精选状态
   * 点赞数 >= FEATURED_COMMENT_LIKE_THRESHOLD 时标记为精选
   */
  updateFeaturedStatus () {
    const shouldFeature = this.likeCount >= FEATURED_COMMENT_LIKE_THRESHOLD
    if (this.isFeatured !== shouldFeature) {
      this.isFeatured = shouldFeature
      return true
    }
    return false
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
      likeCount: this.likeCount,
      isFeatured: this.isFeatured,
      account: this.Account?.toFormattedJSON() || null
    }
  }
}
