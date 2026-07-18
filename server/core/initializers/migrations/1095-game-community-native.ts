import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameComment" (
      "id" bigserial PRIMARY KEY,
      "gameId" integer NOT NULL REFERENCES "game" ("id") ON DELETE CASCADE,
      "accountId" integer REFERENCES "account" ("id") ON DELETE SET NULL,
      "inReplyToCommentId" bigint REFERENCES "gameComment" ("id") ON DELETE CASCADE,
      "text" text NOT NULL,
      "deletedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameComment_game_created_idx" ON "gameComment" ("gameId", "createdAt")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameComment_game_parent_idx" ON "gameComment" ("gameId", "inReplyToCommentId")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameComment_account_idx" ON "gameComment" ("accountId")', { type: QueryTypes.RAW })

  await sequelize.query(`
    INSERT INTO "gameComment" ("id", "gameId", "accountId", "inReplyToCommentId", "text", "deletedAt", "createdAt", "updatedAt")
    SELECT "videoComment"."id", "game"."id", "videoComment"."accountId", "videoComment"."inReplyToCommentId",
      "videoComment"."text", "videoComment"."deletedAt", "videoComment"."createdAt", "videoComment"."updatedAt"
    FROM "videoComment"
    INNER JOIN "game" ON "game"."videoId" = "videoComment"."videoId"
    ON CONFLICT ("id") DO NOTHING
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    SELECT setval(
      pg_get_serial_sequence('"gameComment"', 'id'),
      COALESCE((SELECT MAX("id") FROM "gameComment"), 1),
      EXISTS (SELECT 1 FROM "gameComment")
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query('ALTER TABLE "gameCommentReaction" DROP CONSTRAINT IF EXISTS "gameCommentReaction_commentId_fkey"', { type: QueryTypes.RAW })
  await sequelize.query('ALTER TABLE "gameCommentReaction" ADD CONSTRAINT "gameCommentReaction_comment_fk" FOREIGN KEY ("commentId") REFERENCES "gameComment" ("id") ON DELETE CASCADE', { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameReport" (
      "id" bigserial PRIMARY KEY,
      "reporterAccountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE,
      "gameId" integer REFERENCES "game" ("id") ON DELETE CASCADE,
      "commentId" bigint REFERENCES "gameComment" ("id") ON DELETE CASCADE,
      "reason" text NOT NULL,
      "state" varchar(32) NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending', 'accepted', 'rejected')),
      "predefinedReasons" text[],
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameReport_game_state_idx" ON "gameReport" ("gameId", "state")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameReport_comment_state_idx" ON "gameReport" ("commentId", "state")', { type: QueryTypes.RAW })
  await sequelize.query('CREATE INDEX IF NOT EXISTS "gameReport_reporter_idx" ON "gameReport" ("reporterAccountId")', { type: QueryTypes.RAW })
}
