import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameUserPreference" (
      "id" BIGSERIAL PRIMARY KEY,
      "accountId" INTEGER NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
      "preferredTags" TEXT[] NOT NULL DEFAULT '{}',
      "blockedTags" TEXT[] NOT NULL DEFAULT '{}',
      "preferredCategories" TEXT[] NOT NULL DEFAULT '{}',
      "blockedCategories" TEXT[] NOT NULL DEFAULT '{}',
      "recommendationIntensity" INTEGER NOT NULL DEFAULT 5,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "game_user_preference_account_id"
    ON "gameUserPreference" ("accountId")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    DROP TABLE IF EXISTS "gameUserPreference"
  `, { type: QueryTypes.RAW })
}
