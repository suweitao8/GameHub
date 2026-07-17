import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query('ALTER TABLE "gameCoinLedger" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT NOW()', {
    type: QueryTypes.RAW
  })
}
