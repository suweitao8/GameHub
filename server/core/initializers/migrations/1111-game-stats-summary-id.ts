import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "gameStatsSummary"
      DROP CONSTRAINT IF EXISTS "gameStatsSummary_pkey";
    ALTER TABLE "gameStatsSummary"
      ADD COLUMN IF NOT EXISTS "id" SERIAL;
    ALTER TABLE "gameStatsSummary"
      ADD CONSTRAINT "gameStatsSummary_id_pkey" PRIMARY KEY ("id");
    ALTER TABLE "gameStatsSummary"
      ADD CONSTRAINT "gameStatsSummary_gameId_unique" UNIQUE ("gameId");
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "gameStatsSummary"
      DROP CONSTRAINT IF EXISTS "gameStatsSummary_gameId_unique";
    ALTER TABLE "gameStatsSummary"
      DROP COLUMN IF EXISTS "id";
  `, { type: QueryTypes.RAW })
}
