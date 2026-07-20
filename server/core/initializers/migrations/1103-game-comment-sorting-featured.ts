import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  // 添加 likeCount 冗余字段（避免每次 JOIN 聚合查询）
  await sequelize.query(`
    ALTER TABLE "gameComment"
    ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0
  `, { type: QueryTypes.RAW })

  // 添加 isFeatured 精选评论标记
  await sequelize.query(`
    ALTER TABLE "gameComment"
    ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false
  `, { type: QueryTypes.RAW })

  // 从现有 reaction 数据回填 likeCount
  await sequelize.query(`
    UPDATE "gameComment" gc
    SET "likeCount" = COALESCE(reaction_counts.cnt, 0)
    FROM (
      SELECT "commentId", COUNT(*) AS cnt
      FROM "gameCommentReaction"
      GROUP BY "commentId"
    ) AS reaction_counts
    WHERE gc.id = reaction_counts."commentId"
  `, { type: QueryTypes.RAW })

  // 根据回填后的 likeCount 标记精选评论（阈值 10）
  await sequelize.query(`
    UPDATE "gameComment"
    SET "isFeatured" = true
    WHERE "likeCount" >= 10 AND "deletedAt" IS NULL
  `, { type: QueryTypes.RAW })

  // 添加排序索引
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_comment_game_id_like_count"
    ON "gameComment" ("gameId", "likeCount")
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "game_comment_game_id_featured_created"
    ON "gameComment" ("gameId", "isFeatured", "createdAt")
  `, { type: QueryTypes.RAW })
}

export async function down ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    DROP INDEX IF EXISTS "game_comment_game_id_featured_created"
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    DROP INDEX IF EXISTS "game_comment_game_id_like_count"
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    ALTER TABLE "gameComment"
    DROP COLUMN IF EXISTS "isFeatured"
  `, { type: QueryTypes.RAW })

  await sequelize.query(`
    ALTER TABLE "gameComment"
    DROP COLUMN IF EXISTS "likeCount"
  `, { type: QueryTypes.RAW })
}
