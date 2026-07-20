import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "game"
    ADD COLUMN IF NOT EXISTS "screenshotPaths" TEXT[] NOT NULL DEFAULT '{}'
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "game"
    DROP COLUMN IF EXISTS "screenshotPaths"
  `, { type: QueryTypes.RAW })
}
