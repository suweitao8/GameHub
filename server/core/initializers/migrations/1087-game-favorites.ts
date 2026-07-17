import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameFavorite" (
      "gameId" integer NOT NULL REFERENCES "game" ("id") ON DELETE CASCADE,
      "accountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT "gameFavorite_pkey" PRIMARY KEY ("gameId", "accountId")
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameFavorite_accountId_idx" ON "gameFavorite" ("accountId")', {
    type: QueryTypes.RAW
  })
}
