import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    UPDATE "game"
    SET "status" = 'unlisted', "publishedAt" = NULL, "updatedAt" = NOW()
    WHERE "status" = 'published'
      AND (
        "videoId" IS NOT NULL
        OR "tags" && ARRAY['zip', 'assets']::text[]
      )
  `, { type: QueryTypes.RAW })
}
