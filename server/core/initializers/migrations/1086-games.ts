import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.sequelize.query(`
    CREATE TABLE IF NOT EXISTS "game" (
      "id" serial,
      "uuid" uuid NOT NULL,
      "videoId" integer REFERENCES "video" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "ownerAccountId" integer NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "title" varchar(120) NOT NULL,
      "description" text NOT NULL,
      "instructions" text NOT NULL,
      "category" varchar(64) NOT NULL,
      "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
      "coverPath" text,
      "runtimePath" text NOT NULL,
      "runtimeSha256" char(64) NOT NULL,
      "fileSizeBytes" bigint NOT NULL,
      "status" varchar(32) NOT NULL,
      "moderationReason" text,
      "moderatedByAccountId" integer REFERENCES "account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "moderatedAt" timestamp with time zone,
      "playCount" integer NOT NULL DEFAULT 0,
      "publishedAt" timestamp with time zone,
      "createdAt" timestamp with time zone NOT NULL,
      "updatedAt" timestamp with time zone NOT NULL,
      PRIMARY KEY ("id"),
      CONSTRAINT "game_status_check" CHECK ("status" IN ('pending', 'published', 'rejected', 'unlisted', 'blocked'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "game_uuid_unique" ON "game" ("uuid");
    CREATE UNIQUE INDEX IF NOT EXISTS "game_video_id_unique" ON "game" ("videoId") WHERE "videoId" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "game_status_published_at" ON "game" ("status", "publishedAt" DESC);
    CREATE INDEX IF NOT EXISTS "game_owner_created_at" ON "game" ("ownerAccountId", "createdAt" DESC);
    CREATE INDEX IF NOT EXISTS "game_category" ON "game" ("category");
  `, { transaction: utils.transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
