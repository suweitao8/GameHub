import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "game"
    ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    ALTER TABLE "game"
    ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP WITH TIME ZONE
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_status_featured_featured_at"
    ON "game" ("status", "featured", "featuredAt")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    DROP INDEX IF EXISTS "game_status_featured_featured_at"
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    ALTER TABLE "game"
    DROP COLUMN IF EXISTS "featuredAt"
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    ALTER TABLE "game"
    DROP COLUMN IF EXISTS "featured"
  `, { type: QueryTypes.RAW })
}
