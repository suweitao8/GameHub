import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameCollection" (
      "id" SERIAL PRIMARY KEY,
      "title" VARCHAR(120) NOT NULL,
      "description" TEXT,
      "slug" VARCHAR(120) NOT NULL UNIQUE,
      "coverPath" TEXT,
      "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "publishedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameCollectionItem" (
      "id" SERIAL PRIMARY KEY,
      "collectionId" INTEGER NOT NULL,
      "gameId" INTEGER NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "description" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY ("collectionId") REFERENCES "gameCollection"("id") ON DELETE CASCADE,
      FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE,
      UNIQUE ("collectionId", "gameId")
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_gamecollection_status_sort" ON "gameCollection"("status", "sortOrder")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_gamecollectionitem_collection" ON "gameCollectionItem"("collectionId", "sortOrder")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`DROP TABLE IF EXISTS "gameCollectionItem"`, { type: QueryTypes.RAW })
  await sequelize.query(`DROP TABLE IF EXISTS "gameCollection"`, { type: QueryTypes.RAW })
}
