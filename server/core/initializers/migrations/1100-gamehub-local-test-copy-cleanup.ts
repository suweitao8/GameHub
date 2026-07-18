import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export async function up ({ sequelize }: { sequelize: Sequelize }) {
  await sequelize.query(`
    UPDATE "game"
    SET "title" = CASE "title"
      WHEN 'Edit Flow Game Updated' THEN '编辑流程测试游戏'
      WHEN 'Codex Runtime Check' THEN 'HTML运行测试游戏'
      WHEN 'GameHub upload smoke test' THEN '游戏上传验证'
      WHEN 'Safe Test Game' THEN '安全测试游戏'
      ELSE "title"
    END,
    "description" = CASE "title"
      WHEN 'Edit Flow Game Updated' THEN '用于验证游戏编辑流程。'
      WHEN 'Codex Runtime Check' THEN '用于验证单 HTML 游戏运行。'
      WHEN 'GameHub upload smoke test' THEN '用于验证游戏上传流程。'
      WHEN 'Safe Test Game' THEN '用于验证安全的 HTML 游戏运行。'
      ELSE "description"
    END,
    "instructions" = CASE "title"
      WHEN 'Edit Flow Game Updated' THEN '点击开始测试。'
      WHEN 'Codex Runtime Check' THEN '点击开始测试。'
      WHEN 'GameHub upload smoke test' THEN '点击开始测试。'
      WHEN 'Safe Test Game' THEN '点击开始测试。'
      ELSE "instructions"
    END,
    "updatedAt" = NOW()
    WHERE "title" IN ('Edit Flow Game Updated', 'Codex Runtime Check', 'GameHub upload smoke test', 'Safe Test Game')
  `, { type: QueryTypes.RAW })
}
