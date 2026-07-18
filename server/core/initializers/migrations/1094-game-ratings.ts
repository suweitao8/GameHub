import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameRating" (
      "id" bigserial PRIMARY KEY,
      "gameId" integer NOT NULL REFERENCES "game" ("id") ON DELETE CASCADE,
      "accountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "type" varchar(16) NOT NULL CHECK ("type" IN ('like', 'dislike')),
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "gameRating_game_account_idx" ON "gameRating" ("gameId", "accountId")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameRating_game_type_idx" ON "gameRating" ("gameId", "type")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameRating_account_idx" ON "gameRating" ("accountId")', { type: QueryTypes.RAW })

  await sequelize.query(`
    INSERT INTO "gameRating" ("gameId", "accountId", "type", "createdAt", "updatedAt")
    SELECT "game"."id", "accountVideoRate"."accountId", "accountVideoRate"."type", NOW(), NOW()
    FROM "game"
    INNER JOIN "accountVideoRate" ON "accountVideoRate"."videoId" = "game"."videoId"
    WHERE "accountVideoRate"."type" IN ('like', 'dislike')
    ON CONFLICT ("gameId", "accountId") DO NOTHING
  `, { type: QueryTypes.RAW })
}
