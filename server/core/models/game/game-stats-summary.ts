import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { GameModel } from './game.js'
import { SequelizeModel } from '../shared/index.js'

@Table({
  tableName: 'gameStatsSummary',
  indexes: [
    { fields: [ 'gameId' ], unique: true },
    { fields: [ 'likes' ] },
    { fields: [ 'favorites' ] },
    { fields: [ 'shares' ] },
    { fields: [ 'coins' ] },
    { fields: [ 'comments' ] },
    { fields: [ 'plays' ] },
    { fields: [ 'averageReviewScore' ] }
  ]
})
export class GameStatsSummaryModel extends SequelizeModel<GameStatsSummaryModel> {
  @AllowNull(false)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number

  @BelongsTo(() => GameModel, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @AllowNull(false)
  @Default(0)
  @Column
  declare plays: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare likes: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare dislikes: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare favorites: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare shares: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare coins: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare comments: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare reviews: number

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(3, 1))
  declare averageReviewScore: number

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  static async refreshForGame (gameId: number) {
    const { sequelizeTypescript } = await import('@server/initializers/database.js')

    const [ results ] = await sequelizeTypescript.query(`
      SELECT
        COALESCE((SELECT COUNT(*) FROM "gameRating" WHERE "gameRating"."gameId" = ${gameId} AND "gameRating"."type" = 'like'), 0) AS "likes",
        COALESCE((SELECT COUNT(*) FROM "gameRating" WHERE "gameRating"."gameId" = ${gameId} AND "gameRating"."type" = 'dislike'), 0) AS "dislikes",
        COALESCE((SELECT COUNT(*) FROM "gameFavorite" WHERE "gameFavorite"."gameId" = ${gameId}), 0) AS "favorites",
        COALESCE((SELECT SUM("amount" * -1) FROM "gameCoinLedger" WHERE "gameCoinLedger"."gameId" = ${gameId} AND "gameCoinLedger"."kind" = 'spend'), 0) AS "coins",
        COALESCE((SELECT COUNT(*) FROM "gameComment" WHERE "gameComment"."gameId" = ${gameId} AND "gameComment"."deletedAt" IS NULL), 0) AS "comments",
        COALESCE((SELECT COUNT(*) FROM "gameReview" WHERE "gameReview"."gameId" = ${gameId}), 0) AS "reviews",
        COALESCE((SELECT AVG(score)::numeric FROM "gameReview" WHERE "gameReview"."gameId" = ${gameId}), 0) AS "averageReviewScore",
        COALESCE((SELECT "playCount" FROM "game" WHERE "game"."id" = ${gameId}), 0) AS "plays"
    `)

    const row = results[0] as any

    const existing = await GameStatsSummaryModel.findOne({ where: { gameId } })
    if (existing) {
      await existing.update({
        plays: Number(row.plays) || 0,
        likes: Number(row.likes) || 0,
        dislikes: Number(row.dislikes) || 0,
        favorites: Number(row.favorites) || 0,
        coins: Number(row.coins) || 0,
        comments: Number(row.comments) || 0,
        reviews: Number(row.reviews) || 0,
        averageReviewScore: Number(row.averageReviewScore) || 0
      })
    } else {
      await GameStatsSummaryModel.create({
        gameId,
        plays: Number(row.plays) || 0,
        likes: Number(row.likes) || 0,
        dislikes: Number(row.dislikes) || 0,
        favorites: Number(row.favorites) || 0,
        coins: Number(row.coins) || 0,
        comments: Number(row.comments) || 0,
        reviews: Number(row.reviews) || 0,
        averageReviewScore: Number(row.averageReviewScore) || 0
      })
    }
  }

  static async refreshAll () {
    const { GameModel } = await import('./game.js')
    const games = await GameModel.findAll({ attributes: [ 'id' ], raw: true })

    for (const game of games) {
      await GameStatsSummaryModel.refreshForGame(game.id)
    }
  }
}
