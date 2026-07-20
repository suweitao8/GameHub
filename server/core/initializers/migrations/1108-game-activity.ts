import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameActivity" (
      "id" BIGSERIAL PRIMARY KEY,
      "actorAccountId" INTEGER NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
      "gameId" INTEGER REFERENCES "game"("id") ON DELETE CASCADE,
      "kind" VARCHAR(32) NOT NULL DEFAULT 'publish',
      "message" TEXT NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_activity_actor_created"
    ON "gameActivity" ("actorAccountId", "createdAt")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_activity_game_created"
    ON "gameActivity" ("gameId", "createdAt")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_activity_kind_created"
    ON "gameActivity" ("kind", "createdAt")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    DROP TABLE IF EXISTS "gameActivity"
  `, { type: QueryTypes.RAW })
}
