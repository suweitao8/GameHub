import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameRecent" (
      "gameId" integer NOT NULL REFERENCES "game" ("id") ON DELETE CASCADE,
      "accountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "lastPlayedAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT "gameRecent_pkey" PRIMARY KEY ("gameId", "accountId")
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameRecent_account_lastPlayedAt_idx" ON "gameRecent" ("accountId", "lastPlayedAt" DESC)', {
    type: QueryTypes.RAW
  })
}
