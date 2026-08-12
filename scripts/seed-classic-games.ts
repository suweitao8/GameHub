/**
 * 一次性种子脚本：下架当前全部已发布游戏，并入库 5 个官方经典小游戏。
 *
 * 用法（在仓库根目录，已 build:server 后）：
 *   pnpm run tsx --conditions=peertube:tsx ./scripts/seed-classic-games.ts
 *
 * 设计说明：
 *  - 官方游戏由 root 账号持有，status 直接置为 published、featured=true，
 *    绕过普通投稿的审核流程。
 *  - HTML 文件来自 packages/games/classic/*.html，调用 storeGameRuntimePackage
 *    走和正常上传一致的存储路径(sha256 / 路径校验),保证运行时与审核一致。
 *  - 幂等：重复运行前先按标题删除同名游戏，避免重复入库。
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { CONFIG } from '@server/initializers/config.js'
import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'
import { GameModel } from '@server/models/game/game.js'
import { UserModel } from '@server/models/user/user.js'
import { AccountModel } from '@server/models/account/account.js'
import {
  storeGameRuntimePackage,
  cleanupStoredGameAssets
} from '@server/lib/games/game-runtime.js'
import { createHash } from 'crypto'

interface ClassicGameSpec {
  file: string
  title: string
  description: string
  instructions: string
  category: string
  tags: string[]
}

const GAMES_DIR = join(process.cwd(), 'packages', 'games', 'classic')

const SPECS: ClassicGameSpec[] = [
  {
    file: 'snake.html',
    title: '贪吃蛇',
    description: '经典贪吃蛇：方向键控制蛇身吃豆子，越长越快，别撞到自己。',
    instructions: '方向键或 WASD 控制方向，吃到豆子得分并加速，撞墙或撞到自己游戏结束。',
    category: 'arcade',
    tags: [ '贪吃蛇', 'snake', '经典', '休闲' ]
  },
  {
    file: 'tetris.html',
    title: '俄罗斯方块',
    description: '经典俄罗斯方块：移动、旋转、消行，越快越有挑战。',
    instructions: '左右方向键移动，上键旋转，下键软降，空格硬降，消满一行得分。',
    category: 'puzzle',
    tags: [ '俄罗斯方块', 'tetris', '经典', '益智' ]
  },
  {
    file: 'breakout.html',
    title: '打砖块',
    description: '经典打砖块：控制挡板反弹小球，打掉全部砖块通关。',
    instructions: '鼠标移动或左右方向键控制挡板，反弹小球击碎砖块，别让球掉下去。',
    category: 'arcade',
    tags: [ '打砖块', 'breakout', '经典', '休闲' ]
  },
  {
    file: 'flappy.html',
    title: '像素鸟',
    description: '像素鸟：点击让小鸟飞跃水管间隙，看看你能撑过多少根管道。',
    instructions: '空格键、鼠标点击或触屏点击让小鸟向上飞，穿过水管间隙得分，撞到水管或落地结束。',
    category: 'casual',
    tags: [ '像素鸟', 'flappy', '经典', '休闲' ]
  },
  {
    file: '2048.html',
    title: '2048',
    description: '2048 数字合并：滑动方块让相同数字合并，挑战合成更大的数字。',
    instructions: '方向键或 WASD 滑动所有方块，相同数字相撞会合并并翻倍，目标是合成 2048。',
    category: 'puzzle',
    tags: [ '2048', '数字', '合并', '益智' ]
  }
]

async function main () {
  console.log('→ 初始化数据库模型...')
  await initDatabaseModels(true)

  // 拿 root 账号作为官方游戏持有者
  const user = await UserModel.loadByUsername('root')
  if (!user) throw new Error('找不到 root 用户，请确认开发数据库已初始化（默认账号 root/test）。')
  const account = await AccountModel.loadByUserId(user.id)
  if (!account) throw new Error('root 用户没有关联 Account。')
  const ownerId = account.id
  console.log(`→ 使用账号 @${account.name} (id=${ownerId}) 持有官方游戏`)

  // 1) 下架当前所有已发布游戏(软删除 → unlisted)，保留数据便于回滚
  const [ unlistedCount ] = await GameModel.update(
    { status: 'unlisted', publishedAt: null },
    { where: { status: 'published' } }
  )
  console.log(`→ 已下架 ${unlistedCount} 个原有游戏（status → unlisted）`)

  // 2) 逐个入库 5 个经典游戏
  for (const spec of SPECS) {
    const filePath = join(GAMES_DIR, spec.file)
    const content = readFileSync(filePath)
    console.log(`→ 入库《${spec.title}》(${spec.file}, ${(content.length / 1024).toFixed(1)} KB)...`)

    // 幂等：先删同名旧记录(可能是上次 seed 残留)
    await GameModel.destroy({ where: { title: spec.title, ownerAccountId: ownerId } })

    const stored = await storeGameRuntimePackage({
      root: CONFIG.STORAGE.GAMES_DIR,
      filename: spec.file,
      mimeType: 'text/html',
      content
    })

    const game = await GameModel.create({
      ownerAccountId: ownerId,
      title: spec.title,
      description: spec.description,
      instructions: spec.instructions,
      category: spec.category,
      tags: spec.tags,
      runtimePath: stored.relativePath,
      runtimeSha256: stored.runtimeSha256,
      fileSizeBytes: stored.fileSizeBytes,
      coverPath: null,
      screenshotPaths: [],
      status: 'published',
      featured: true,
      publishedAt: new Date()
    })
    console.log(`   ✓ uuid=${game.uuid}`)
  }

  // 3) 确认结果
  const published = await GameModel.count({ where: { status: 'published' } })
  console.log(`\n✅ 完成。当前 published 游戏数：${published}`)
  await sequelizeTypescript.close()
}

main().catch(err => {
  console.error('✗ 种子失败：', err)
  process.exit(1)
})
