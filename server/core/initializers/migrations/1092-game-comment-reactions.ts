import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameCommentReaction" (
      "id" bigserial PRIMARY KEY,
      "commentId" integer NOT NULL REFERENCES "videoComment" ("id") ON DELETE CASCADE,
      "accountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "gameCommentReaction_comment_account_idx" ON "gameCommentReaction" ("commentId", "accountId")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameCommentReaction_comment_idx" ON "gameCommentReaction" ("commentId")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameCommentReaction_account_idx" ON "gameCommentReaction" ("accountId")', { type: QueryTypes.RAW })
}
