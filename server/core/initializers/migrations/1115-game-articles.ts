import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameArticle" (
      "id" SERIAL PRIMARY KEY,
      "title" VARCHAR(160) NOT NULL,
      "summary" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "slug" VARCHAR(160) NOT NULL UNIQUE,
      "coverPath" TEXT,
      "category" VARCHAR(64) NOT NULL DEFAULT '心得',
      "status" VARCHAR(32) NOT NULL DEFAULT 'published',
      "viewCount" INTEGER NOT NULL DEFAULT 0,
      "createdByAccountId" INTEGER NOT NULL,
      "publishedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY ("createdByAccountId") REFERENCES "account"("id") ON DELETE CASCADE
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_gamearticle_status_published" ON "gameArticle"("status", "publishedAt" DESC)
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_gamearticle_creator_created" ON "gameArticle"("createdByAccountId", "createdAt" DESC)
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`DROP TABLE IF EXISTS "gameArticle"`, { type: QueryTypes.RAW })
}
