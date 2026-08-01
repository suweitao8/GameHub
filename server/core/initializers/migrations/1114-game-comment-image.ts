import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "gameComment"
      ADD COLUMN IF NOT EXISTS "imagePath" TEXT;
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "gameComment" DROP COLUMN IF EXISTS "imagePath";
  `, { type: QueryTypes.RAW })
}
