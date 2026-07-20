import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameStatsSummary" (
      "gameId" INTEGER NOT NULL,
      "plays" INTEGER NOT NULL DEFAULT 0,
      "likes" INTEGER NOT NULL DEFAULT 0,
      "dislikes" INTEGER NOT NULL DEFAULT 0,
      "favorites" INTEGER NOT NULL DEFAULT 0,
      "coins" INTEGER NOT NULL DEFAULT 0,
      "comments" INTEGER NOT NULL DEFAULT 0,
      "reviews" INTEGER NOT NULL DEFAULT 0,
      "averageReviewScore" DECIMAL(3,1) NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      PRIMARY KEY ("gameId")
    );

    CREATE INDEX IF NOT EXISTS "gameStatsSummary_gameId" ON "gameStatsSummary" ("gameId");
    CREATE INDEX IF NOT EXISTS "gameStatsSummary_likes" ON "gameStatsSummary" ("likes");
    CREATE INDEX IF NOT EXISTS "gameStatsSummary_favorites" ON "gameStatsSummary" ("favorites");
    CREATE INDEX IF NOT EXISTS "gameStatsSummary_coins" ON "gameStatsSummary" ("coins");
    CREATE INDEX IF NOT EXISTS "gameStatsSummary_comments" ON "gameStatsSummary" ("comments");
    CREATE INDEX IF NOT EXISTS "gameStatsSummary_plays" ON "gameStatsSummary" ("plays");
    CREATE INDEX IF NOT EXISTS "gameStatsSummary_averageReviewScore" ON "gameStatsSummary" ("averageReviewScore");

    ALTER TABLE "gameStatsSummary"
      ADD CONSTRAINT "gameStatsSummary_gameId_fkey"
      FOREIGN KEY ("gameId") REFERENCES "game" ("id") ON DELETE CASCADE;
  `, { type: QueryTypes.RAW })

  // Backfill existing game stats
  await sequelize.query(`
    INSERT INTO "gameStatsSummary" ("gameId", "plays", "likes", "dislikes", "favorites", "coins", "comments", "reviews", "averageReviewScore", "createdAt", "updatedAt")
    SELECT
      g."id",
      g."playCount",
      COALESCE((SELECT COUNT(*) FROM "gameRating" WHERE "gameRating"."gameId" = g."id" AND "gameRating"."type" = 'like'), 0),
      COALESCE((SELECT COUNT(*) FROM "gameRating" WHERE "gameRating"."gameId" = g."id" AND "gameRating"."type" = 'dislike'), 0),
      COALESCE((SELECT COUNT(*) FROM "gameFavorite" WHERE "gameFavorite"."gameId" = g."id"), 0),
      COALESCE((SELECT SUM("amount" * -1) FROM "gameCoinLedger" WHERE "gameCoinLedger"."gameId" = g."id" AND "gameCoinLedger"."kind" = 'spend'), 0),
      COALESCE((SELECT COUNT(*) FROM "gameComment" WHERE "gameComment"."gameId" = g."id" AND "gameComment"."deletedAt" IS NULL), 0),
      COALESCE((SELECT COUNT(*) FROM "gameReview" WHERE "gameReview"."gameId" = g."id"), 0),
      COALESCE((SELECT AVG("score")::numeric FROM "gameReview" WHERE "gameReview"."gameId" = g."id"), 0),
      NOW(),
      NOW()
    FROM "game" g
    ON CONFLICT ("gameId") DO NOTHING
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`DROP TABLE IF EXISTS "gameStatsSummary"`, { type: QueryTypes.RAW })
}
