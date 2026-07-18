import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameReview" (
      "id" bigserial PRIMARY KEY,
      "gameId" integer NOT NULL REFERENCES "game" ("id") ON DELETE CASCADE,
      "accountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "score" smallint NOT NULL CHECK ("score" BETWEEN 1 AND 5),
      "text" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "gameReview_game_account_idx" ON "gameReview" ("gameId", "accountId")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameReview_game_created_idx" ON "gameReview" ("gameId", "createdAt")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameReview_account_idx" ON "gameReview" ("accountId")', { type: QueryTypes.RAW })
}
