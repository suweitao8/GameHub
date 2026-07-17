import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameNotification" (
      "id" bigserial PRIMARY KEY,
      "recipientAccountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "actorAccountId" integer REFERENCES "account" ("id") ON DELETE SET NULL,
      "gameId" integer REFERENCES "game" ("id") ON DELETE SET NULL,
      "kind" varchar(32) NOT NULL CHECK ("kind" IN ('comment', 'reply', 'like', 'coin', 'favorite', 'follow', 'moderation', 'system')),
      "message" text NOT NULL,
      "readAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameNotification_recipient_created_idx" ON "gameNotification" ("recipientAccountId", "createdAt" DESC)', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameNotification_recipient_read_idx" ON "gameNotification" ("recipientAccountId", "readAt")', { type: QueryTypes.RAW })
}
