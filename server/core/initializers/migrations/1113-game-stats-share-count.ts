import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    ALTER TABLE "gameStatsSummary"
      ADD COLUMN IF NOT EXISTS "shares" INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS "gameStatsSummary_shares" ON "gameStatsSummary" ("shares");
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    DROP INDEX IF EXISTS "gameStatsSummary_shares";
    ALTER TABLE "gameStatsSummary" DROP COLUMN IF EXISTS "shares";
  `, { type: QueryTypes.RAW })
}
