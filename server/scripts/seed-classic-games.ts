/**
 * 一次性种子脚本：按需下架当前全部已发布游戏，并入库 30 个官方经典小游戏。
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
import { AccountModel } from '@server/models/account/account.js'
import {
  storeGameRuntimePackage
} from '@server/lib/games/game-runtime.js'

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
  },
  {
    file: 'pong.html',
    title: '乒乓',
    description: '经典乒乓：控制挡板反弹小球，和电脑对手对决，先得 7 分获胜。',
    instructions: '鼠标或上下方向键（W/S）控制左侧挡板，先得 7 分获胜。',
    category: 'sports',
    tags: [ '乒乓', 'pong', '经典', '运动' ]
  },
  {
    file: 'minesweeper.html',
    title: '扫雷',
    description: '经典扫雷：点开所有安全格，插旗标记地雷，别踩到雷。',
    instructions: '左键点开格子，右键或长按标记/取消旗帜。数字表示周围地雷数。',
    category: 'puzzle',
    tags: [ '扫雷', 'minesweeper', '益智', '逻辑' ]
  },
  {
    file: 'gomoku.html',
    title: '五子棋',
    description: '五子棋人机对战：连成五子获胜，电脑对手会防守和进攻。',
    instructions: '点击棋盘交叉点落子（黑棋先手），横竖斜任意方向连成五子获胜。',
    category: 'board',
    tags: [ '五子棋', 'gomoku', '棋类', '策略' ]
  },
  {
    file: 'pacman.html',
    title: '吃豆人',
    description: '吃豆人：在迷宫里吃光所有豆子，躲开四个幽灵，吃到大豆子可反吃幽灵。',
    instructions: '方向键或 WASD 控制吃豆人移动，吃光所有豆子获胜。吃闪烁的大豆子后可短暂吃掉幽灵。',
    category: 'arcade',
    tags: [ '吃豆人', 'pac-man', '迷宫', '动作' ]
  },
  {
    file: 'asteroids.html',
    title: '太空射击',
    description: '太空射击：驾驶飞船躲避并击碎飞来的陨石，存活越久得分越高。',
    instructions: '左右方向键或 A/D 移动飞船，空格键发射子弹击碎陨石。陨石被击中会分裂成小块。',
    category: 'shooter',
    tags: [ '太空射击', 'asteroids', '射击', '动作' ]
  },
  {
    file: 'memory.html',
    title: '记忆翻牌',
    description: '记忆翻牌：翻开两张相同图案的卡片配对，用最少步数配对所有卡片。',
    instructions: '点击卡片翻开，每次翻开两张，图案相同则配对成功，否则翻回。',
    category: 'puzzle',
    tags: [ '记忆翻牌', 'memory', '记忆', '益智' ]
  },
  {
    file: 'sokoban.html',
    title: '推箱子',
    description: '推箱子：把所有箱子推到目标点，箱子只能推不能拉，规划好路线。',
    instructions: '方向键或 WASD 控制角色移动，把所有橙色箱子推到绿色目标点上。',
    category: 'puzzle',
    tags: [ '推箱子', 'sokoban', '益智', '策略' ]
  },
  {
    file: 'tictactoe.html',
    title: '井字棋',
    description: '井字棋：和电脑对手在 3×3 棋盘上连成一线获胜，电脑使用 minimax 算法几乎不可战胜。',
    instructions: '点击空格落子（你执 X 先手），横竖斜任意方向三连获胜。电脑使用完美策略。',
    category: 'board',
    tags: [ '井字棋', 'tic-tac-toe', '棋类', 'AI' ]
  },
  {
    file: 'stack.html',
    title: '堆方块',
    description: '堆方块：在合适时机点击让移动的方块精准堆叠，越堆越高。',
    instructions: '点击或空格键放下移动的方块，精准对齐则不缩减，偏移越大切掉越多。',
    category: 'casual',
    tags: [ '堆方块', 'stack', '益智', '节奏' ]
  },
  {
    file: 'jump.html',
    title: '跳一跳',
    description: '跳一跳：长按蓄力让小棋子跳到下一个平台，力度要刚好，掉下去就结束。',
    instructions: '鼠标按住或长按屏幕蓄力，松开跳跃。力度越大跳越远。',
    category: 'casual',
    tags: [ '跳一跳', 'jump', '休闲', '节奏' ]
  },
  {
    file: 'reaction.html',
    title: '反应测试',
    description: '反应速度测试：等屏幕变绿立即点击，测试你的反应毫秒数，5 轮取平均。',
    instructions: '点击开始后等屏幕变绿，变绿瞬间立即点击。太早点击算失败。共 5 轮取平均反应时间。',
    category: 'casual',
    tags: [ '反应测试', 'reaction', '休闲', '测试' ]
  },
  {
    file: 'puzzle15.html',
    title: '数字华容道',
    description: '数字华容道：滑动数字方块按 1-15 顺序排列，用最少步数还原。',
    instructions: '点击与空格相邻的数字方块滑入空格，把数字按 1-15 顺序排列即获胜。',
    category: 'puzzle',
    tags: [ '数字华容道', '15-puzzle', '滑块', '益智' ]
  },
  {
    file: 'whack.html',
    title: '打地鼠',
    description: '打地鼠：地鼠随机冒头，快速点击敲打，30 秒内打中越多分数越高。',
    instructions: '点击冒头的地鼠得分，金鼠加倍，炸弹扣分。30 秒倒计时内尽量多打。',
    category: 'casual',
    tags: [ '打地鼠', 'whack', '休闲', '反应' ]
  },
  {
    file: 'tank.html',
    title: '坦克大战',
    description: '坦克大战：驾驶坦克在战场消灭所有敌方坦克，利用墙壁做掩护。',
    instructions: '方向键或 WASD 移动坦克，空格发射炮弹。消灭所有敌方坦克获胜。',
    category: 'shooter',
    tags: [ '坦克大战', 'tank', '射击', '动作' ]
  },
  {
    file: 'stroop.html',
    title: '颜色反应',
    description: '颜色反应：看文字的颜色（不是字义）选出正确颜色，考验大脑抗干扰能力。',
    instructions: '注意上方文字的颜色而非字义，点击下方对应颜色按钮。30 秒内答对越多越好。',
    category: 'casual',
    tags: [ '颜色反应', 'stroop', '脑力', '反应' ]
  },
  {
    file: 'space-invaders.html',
    title: '太空入侵者',
    description: '太空入侵者：移动战机击退不断逼近的外星舰队，守住三条生命。',
    instructions: '方向键或 A/D 移动，空格键发射。触屏可使用下方控制按钮。击败所有外星人进入下一波。',
    category: 'shooter',
    tags: [ '太空入侵者', 'space-invaders', '街机', '射击' ]
  },
  {
    file: 'connect-four.html',
    title: '四子棋',
    description: '四子棋人机对战：抢占列位，先在任意方向连成四子获胜。',
    instructions: '点击任意列落下红棋。电脑执黄棋，会优先完成四连或封堵你的威胁。',
    category: 'board',
    tags: [ '四子棋', 'connect-four', '棋类', '策略' ]
  },
  {
    file: 'reversi.html',
    title: '黑白棋',
    description: '黑白棋人机对战：夹住并翻转对方棋子，终局时棋子更多的一方获胜。',
    instructions: '点击高亮合法位置落黑子。棋子会翻转被夹住的白子，无法落子时自动跳过。',
    category: 'board',
    tags: [ '黑白棋', 'reversi', 'othello', '策略' ]
  },
  {
    file: 'checkers.html',
    title: '国际跳棋',
    description: '国际跳棋人机对战：斜向移动，跳过对方棋子吃子，抵达底线即可升王。',
    instructions: '先点击自己的红棋，再点击高亮的合法目标格。若有可吃的棋必须优先吃子。',
    category: 'board',
    tags: [ '国际跳棋', 'checkers', '棋类', '策略' ]
  },
  {
    file: 'sudoku.html',
    title: '数独',
    description: '数独：在 9×9 宫格中填入数字 1 到 9，让每一行、列和小宫都不重复。',
    instructions: '先点击空格，再点击下方数字或使用键盘 1-9 填入。红色数字表示与同一行、列或宫冲突。',
    category: 'puzzle',
    tags: [ '数独', 'sudoku', '益智', '逻辑' ]
  },
  {
    file: 'simon.html',
    title: '记忆序列',
    description: '记忆序列：观察亮起的四色序列并按相同顺序复现，回合越多难度越高。',
    instructions: '等待颜色依次亮起后，按相同顺序点击四色按钮。每成功一轮会新增一个颜色。',
    category: 'casual',
    tags: [ '记忆序列', 'simon', '反应', '记忆' ]
  },
  {
    file: 'frogger.html',
    title: '青蛙过河',
    description: '青蛙过河：穿越车流与河面，借助漂浮木头抵达顶端的安全荷叶。',
    instructions: '方向键、WASD 或下方按钮每次移动一格。避开车辆，河面必须站在木头上。',
    category: 'arcade',
    tags: [ '青蛙过河', 'frogger', '街机', '动作' ]
  },
  {
    file: 'bubble-shooter.html',
    title: '泡泡龙',
    description: '泡泡龙：瞄准并发射彩色泡泡，连接三个或更多相同颜色即可消除。',
    instructions: '移动鼠标或触摸瞄准，点击画布发射。三颗及以上同色泡泡相连会消除。',
    category: 'puzzle',
    tags: [ '泡泡龙', 'bubble-shooter', '街机', '益智' ]
  },
  {
    file: 'blackjack.html',
    title: '纸牌 21 点',
    description: '纸牌 21 点：与庄家比拼点数，尽量接近 21 但不能爆牌。',
    instructions: '点击要牌继续抽牌，点击停牌让庄家补牌到 17 点。A 可作 1 或 11 点。',
    category: 'board',
    tags: [ '纸牌 21 点', 'blackjack', '扑克', '策略' ]
  },
  {
    file: 'hangman.html',
    title: '猜单词',
    description: '猜单词：根据中文提示猜出英文单词，六次错误前找全所有字母。',
    instructions: '点击字母键盘或使用实体键盘猜字母。每猜错一次，绞刑架会增加一笔。',
    category: 'puzzle',
    tags: [ '猜单词', 'hangman', '单词', '益智' ]
  }
]

async function main () {
  console.log('→ 初始化数据库模型...')
  await initDatabaseModels(true)

  // 拿 root 账号作为官方游戏持有者
  const account = await AccountModel.loadLocalByName('root')
  if (!account) throw new Error('找不到 root 账号，请确认开发数据库已初始化（默认账号 root/test）。')
  const ownerId = account.id
  console.log(`→ 使用账号 @${account.name} (id=${ownerId}) 持有官方游戏`)

  // 默认只增量入库;加 --clean 才下架其他已发布游戏
  if (process.argv.includes('--clean')) {
    const [ unlistedCount ] = await GameModel.update(
      { status: 'unlisted', publishedAt: null },
      { where: { status: 'published' } }
    )
    console.log(`→ 已下架 ${unlistedCount} 个原有游戏（status → unlisted）`)
  }

  // 2) 逐个入库官方经典游戏
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
