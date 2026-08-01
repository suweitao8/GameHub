import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameChatMessage" (
      "id" BIGSERIAL PRIMARY KEY,
      "gameId" INTEGER NOT NULL REFERENCES "game"("id") ON DELETE CASCADE,
      "accountId" INTEGER NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
      "text" TEXT NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_chat_message_game_created"
    ON "gameChatMessage" ("gameId", "createdAt")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_chat_message_account_created"
    ON "gameChatMessage" ("accountId", "createdAt")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query('DROP TABLE IF EXISTS "gameChatMessage"', { type: QueryTypes.RAW })
}
