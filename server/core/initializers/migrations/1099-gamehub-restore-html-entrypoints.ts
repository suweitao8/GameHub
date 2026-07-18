import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    UPDATE "game"
    SET "videoId" = NULL,
        "status" = 'published',
        "publishedAt" = COALESCE("publishedAt", "createdAt"),
        "updatedAt" = NOW()
    WHERE "status" = 'unlisted'
      AND "runtimePath" LIKE '%/index.html'
      AND NOT ("tags" && ARRAY['zip', 'assets']::text[])
  `, { type: QueryTypes.RAW })
}
