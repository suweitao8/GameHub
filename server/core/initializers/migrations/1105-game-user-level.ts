import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameUserLevel" (
      "id" SERIAL PRIMARY KEY,
      "accountId" INTEGER NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
      "exp" INTEGER NOT NULL DEFAULT 0,
      "dailyLoginClaimed" BOOLEAN NOT NULL DEFAULT false,
      "dailyLoginClaimedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "game_user_level_account_id"
    ON "gameUserLevel" ("accountId")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    DROP TABLE IF EXISTS "gameUserLevel"
  `, { type: QueryTypes.RAW })
}
