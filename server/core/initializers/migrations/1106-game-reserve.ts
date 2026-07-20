import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameReserve" (
      "id" BIGSERIAL PRIMARY KEY,
      "gameId" INTEGER NOT NULL REFERENCES "game"("id") ON DELETE CASCADE,
      "accountId" INTEGER NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
      "notified" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "game_reserve_game_account"
    ON "gameReserve" ("gameId", "accountId")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_reserve_account_id"
    ON "gameReserve" ("accountId", "createdAt")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    ALTER TABLE "game"
    ADD COLUMN IF NOT EXISTS "releaseDate" TIMESTAMP WITH TIME ZONE
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_release_date"
    ON "game" ("releaseDate")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    DROP INDEX IF EXISTS "game_release_date"
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    ALTER TABLE "game"
    DROP COLUMN IF EXISTS "releaseDate"
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    DROP TABLE IF EXISTS "gameReserve"
  `, { type: QueryTypes.RAW })
}
