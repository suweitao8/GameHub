import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameCoinLedger" (
      "id" bigserial PRIMARY KEY,
      "accountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "gameId" integer REFERENCES "game" ("id") ON DELETE CASCADE,
      "amount" integer NOT NULL CHECK ("amount" <> 0),
      "kind" varchar(32) NOT NULL CHECK ("kind" IN ('daily_grant', 'spend')),
      "day" date NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "gameCoinLedger_daily_grant_idx"
    ON "gameCoinLedger" ("accountId", "day", "kind") WHERE "kind" = 'daily_grant'
  `, { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameCoinLedger_account_idx" ON "gameCoinLedger" ("accountId")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameCoinLedger_game_account_idx" ON "gameCoinLedger" ("gameId", "accountId")', { type: QueryTypes.RAW })
}
