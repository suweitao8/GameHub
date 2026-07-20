import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameEvent" (
      "id" SERIAL PRIMARY KEY,
      "title" VARCHAR(120) NOT NULL,
      "description" TEXT,
      "slug" VARCHAR(120) NOT NULL UNIQUE,
      "type" VARCHAR(32) NOT NULL DEFAULT 'activity',
      "status" VARCHAR(32) NOT NULL DEFAULT 'upcoming',
      "coverPath" TEXT,
      "startAt" TIMESTAMP WITH TIME ZONE,
      "endAt" TIMESTAMP WITH TIME ZONE,
      "rules" TEXT,
      "prizes" TEXT,
      "maxParticipants" INTEGER NOT NULL DEFAULT 0,
      "participantCount" INTEGER NOT NULL DEFAULT 0,
      "createdByAccountId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY ("createdByAccountId") REFERENCES "account"("id") ON DELETE CASCADE
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_gameevent_status_start" ON "gameEvent"("status", "startAt")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_gameevent_type_status" ON "gameEvent"("type", "status")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "gameEventParticipant" (
      "id" SERIAL PRIMARY KEY,
      "eventId" INTEGER NOT NULL,
      "accountId" INTEGER NOT NULL,
      "entryData" TEXT,
      "state" VARCHAR(32) NOT NULL DEFAULT 'registered',
      "rank" INTEGER,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY ("eventId") REFERENCES "gameEvent"("id") ON DELETE CASCADE,
      FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE,
      UNIQUE ("eventId", "accountId")
    )
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_gameeventparticipant_event" ON "gameEventParticipant"("eventId")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`DROP TABLE IF EXISTS "gameEventParticipant"`, { type: QueryTypes.RAW })
  await sequelize.query(`DROP TABLE IF EXISTS "gameEvent"`, { type: QueryTypes.RAW })
}
