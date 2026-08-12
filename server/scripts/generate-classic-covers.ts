/**
 * 一次性脚本：为 5 个经典小游戏生成特色封面并写入 game.coverPath。
 *
 * 用法（build:server 后）：
 *   NODE_ENV=dev node ./dist/scripts/generate-classic-covers.js
 *
 * 每个游戏用各自的代表色和图形元素(SVG → sharp → PNG)，
 * 而不是千篇一律的渐变，保证列表页有辨识度。
 * 幂等：已存在 coverPath 的游戏会跳过（可用 --force 覆盖）。
 */
import sharp from 'sharp'
import { CONFIG } from '@server/initializers/config.js'
import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'
import { GameModel } from '@server/models/game/game.js'
import { storeGameCover } from '@server/lib/games/game-runtime.js'

const W = 1280
const H = 720
const FORCE = process.argv.includes('--force')

const FONT = 'Microsoft YaHei,Segoe UI,Arial,sans-serif'

function escapeXml (s: string) {
  const escapes: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }
  return s.replace(/[<>&'"]/g, c => escapes[c])
}

/** 底部统一标题栏：游戏名 + GameHub 副标。返回完整 SVG 字符串。 */
function withTitleBar (scene: string, title: string, subtitle: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${scene}
<rect x="0" y="${H - 160}" width="${W}" height="160" fill="rgba(15,20,25,0.78)"/>
<text x="64" y="${H - 88}" font-family="${FONT}" font-weight="800" font-size="68" fill="#ffffff">${escapeXml(title)}</text>
<text x="68" y="${H - 44}" font-family="${FONT}" font-weight="600" font-size="26" fill="#8b98a5">${escapeXml(subtitle)}</text>
</svg>`
}

// 贪吃蛇：深绿底 + 蓝色蛇身格子 + 粉色豆子
function snakeCover () {
  const cell = 56
  const cols = Math.floor(W / cell)
  // 一条蜿蜒的蛇身
  const snake = [ [ 4, 6 ], [ 5, 6 ], [ 6, 6 ], [ 6, 5 ], [ 6, 4 ], [ 7, 4 ], [ 8, 4 ], [ 9, 4 ], [ 9, 5 ] ]
  const body = snake.map(([ x, y ], i) => {
    const c = i === 0 ? '#00d4ff' : '#00aeec'
    return `<rect x="${x * cell + 4}" y="${y * cell + 4}" width="${cell - 8}" height="${cell - 8}" rx="8" fill="${c}"/>`
  }).join('')
  // 网格
  let grid = ''
  for (let x = 0; x < cols; x++) grid += `<line x1="${x * cell}" y1="0" x2="${x * cell}" y2="${H - 160}" stroke="rgba(255,255,255,0.04)"/>`
  return withTitleBar(
    `<rect width="${W}" height="${H}" fill="#0d1f17"/>${grid}${body}<circle cx="${12 * cell + cell / 2}" cy="${7 * cell + cell / 2}" r="18" fill="#fb7299"/>`,
    '贪吃蛇', '方向键控制 · 越吃越长'
  )
}

// 俄罗斯方块：深紫底 + 彩色方块堆叠
function tetrisCover () {
  const colors = [ '#00aeec', '#ffd33d', '#fb7299', '#00c091', '#a371f7', '#ff8c42', '#4ec9ff' ]
  const blocks = [
    [ 2, 8, 0 ], [ 3, 8, 1 ], [ 4, 8, 2 ], [ 5, 8, 3 ],
    [ 3, 7, 4 ], [ 4, 7, 5 ], [ 4, 6, 6 ], [ 5, 6, 0 ],
    [ 6, 8, 1 ], [ 6, 7, 2 ], [ 7, 7, 3 ], [ 7, 8, 4 ]
  ]
  const cell = 80
  const body = blocks.map(([ x, y, c ]) =>
    `<rect x="${x * cell + 4}" y="${y * cell + 4}" width="${cell - 8}" height="${cell - 8}" rx="6" fill="${colors[c]}"/><rect x="${x * cell + 8}" y="${y * cell + 8}" width="${cell - 16}" height="8" fill="rgba(255,255,255,0.25)"/>`
  ).join('')
  // 下落的方块
  const falling = `<rect x="${9 * cell + 4}" y="${2 * cell}" width="${cell - 8}" height="${cell - 8}" rx="6" fill="${colors[2]}"/>`
  return withTitleBar(
    `<rect width="${W}" height="${H}" fill="#1a1530"/>${body}${falling}`,
    '俄罗斯方块', '移动 · 旋转 · 消行'
  )
}

// 打砖块：深蓝底 + 彩色砖墙 + 小球 + 挡板
function breakoutCover () {
  const colors = [ '#fb7299', '#ff8c42', '#ffd33d', '#00c091', '#00aeec' ]
  const rows = 5, cols = 12, bw = 90, bh = 28, ox = 64, oy = 70
  let wall = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      wall += `<rect x="${ox + c * (bw + 6)}" y="${oy + r * (bh + 6)}" width="${bw}" height="${bh}" rx="4" fill="${colors[r]}"/>`
    }
  }
  return withTitleBar(
    `<rect width="${W}" height="${H}" fill="#101820"/>${wall}
<rect x="520" y="440" width="180" height="14" rx="7" fill="#00aeec"/>
<circle cx="640" cy="360" r="14" fill="#ffffff"/>
<circle cx="640" cy="360" r="20" fill="rgba(255,255,255,0.25)"/>`,
    '打砖块', '反弹小球 · 击碎砖墙'
  )
}

// 像素鸟：天空渐变 + 绿水管 + 小鸟
function flappyCover () {
  return withTitleBar(
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a3441"/><stop offset="1" stop-color="#3a4a5a"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect x="200" y="0" width="70" height="320" fill="#00c091"/>
<rect x="194" y="300" width="82" height="26" fill="#00d49a"/>
<rect x="700" y="240" width="70" height="${H}" fill="#00c091"/>
<rect x="694" y="220" width="82" height="26" fill="#00d49a"/>
<circle cx="640" cy="380" r="30" fill="#00aeec"/>
<ellipse cx="624" cy="384" rx="14" ry="8" fill="#ffffff"/>
<circle cx="652" cy="372" r="7" fill="#ffffff"/><circle cx="654" cy="372" r="3.5" fill="#0f1419"/>
<polygon points="668,378 684,384 668,390" fill="#ffd33d"/>`,
    '像素鸟', '点击飞跃 · 穿越水管'
  )
}

// 2048：暖色底 + 数字方块网格
function g2048Cover () {
  const tiles = [
    [ 0, 0, '2', '#2a3441' ], [ 1, 0, '4', '#2d3a4a' ], [ 2, 0, '8', '#00aeec' ], [ 3, 0, '16', '#0096cc' ],
    [ 0, 1, '32', '#fb7299' ], [ 1, 1, '64', '#e95b86' ], [ 2, 1, '128', '#ff8c42' ], [ 3, 1, '256', '#ff6b1a' ],
    [ 0, 2, '512', '#a371f7' ], [ 1, 2, '1024', '#7b4ddb' ], [ 2, 2, '2048', '#ffd33d' ], [ 3, 2, '', '#243040' ]
  ]
  const cell = 130, gap = 14, ox = 300, oy = 120
  let body = `<rect x="${ox - gap}" y="${oy - gap}" width="${4 * cell + 3 * gap + gap * 2}" height="${3 * cell + 2 * gap + gap * 2}" rx="12" fill="rgba(255,255,255,0.05)"/>`
  for (const [ x, y, num, color ] of tiles) {
    body += `<rect x="${ox + (x as number) * (cell + gap)}" y="${oy + (y as number) * (cell + gap)}" width="${cell}" height="${cell}" rx="10" fill="${color}"/>`
    if (num) {
      const fs = (num as string).length <= 2 ? 56 : (num as string).length <= 3 ? 46 : 38
      body += `<text x="${ox + (x as number) * (cell + gap) + cell / 2}" y="${oy + (y as number) * (cell + gap) + cell / 2 + fs / 3}" font-family="${FONT}" font-weight="800" font-size="${fs}" fill="${num === '2048' ? '#1a2028' : '#ffffff'}" text-anchor="middle">${num}</text>`
    }
  }
  return withTitleBar(
    `<rect width="${W}" height="${H}" fill="#0f1419"/>${body}`,
    '2048', '滑动合并 · 挑战 2048'
  )
}

/** 通用 emoji 封面:大号 emoji 居中 + 主题色渐变背景 + 标题栏。 */
function emojiCover (emoji: string, bgFrom: string, bgTo: string, title: string, subtitle: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgFrom}"/><stop offset="1" stop-color="${bgTo}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<text x="${W / 2}" y="360" font-size="220" text-anchor="middle">${emoji}</text>
<rect x="0" y="${H - 160}" width="${W}" height="160" fill="rgba(15,20,25,0.78)"/>
<text x="64" y="${H - 88}" font-family="${FONT}" font-weight="800" font-size="68" fill="#ffffff">${escapeXml(title)}</text>
<text x="68" y="${H - 44}" font-family="${FONT}" font-weight="600" font-size="26" fill="#8b98a5">${escapeXml(subtitle)}</text>
</svg>`
}

const GENERATORS: Record<string, () => string> = {
  '贪吃蛇': snakeCover,
  '俄罗斯方块': tetrisCover,
  '打砖块': breakoutCover,
  '像素鸟': flappyCover,
  '2048': g2048Cover,
  '乒乓': () => emojiCover('🏓', '#1a3a5a', '#0d4a7a', '乒乓', '反弹小球 · 先得 7 分'),
  '扫雷': () => emojiCover('💣', '#3a2a1a', '#5a3a1a', '扫雷', '推理排雷 · 别踩到'),
  '五子棋': () => emojiCover('⚫', '#2a2a3a', '#1a1a2a', '五子棋', '连成五子 · 人机对战'),
  '吃豆人': () => emojiCover('🟡', '#1a1a4a', '#0a0a3a', '吃豆人', '吃光豆子 · 躲避幽灵'),
  '太空射击': () => emojiCover('🚀', '#0a1a3a', '#1a0a3a', '太空射击', '击碎陨石 · 存活得分'),
  '记忆翻牌': () => emojiCover('🃏', '#3a1a3a', '#5a2a4a', '记忆翻牌', '配对相同 · 最少步数'),
  '推箱子': () => emojiCover('📦', '#3a2a1a', '#4a3a2a', '推箱子', '推到目标 · 不能拉回'),
  '井字棋': () => emojiCover('⭕', '#1a3a3a', '#0a2a2a', '井字棋', '三连获胜 · 完美 AI'),
  '堆方块': () => emojiCover('🟦', '#1a2a4a', '#2a1a4a', '堆方块', '精准堆叠 · 越堆越高'),
  '跳一跳': () => emojiCover('🎯', '#2a3a1a', '#3a4a2a', '跳一跳', '蓄力跳跃 · 精准落地'),
  '反应测试': () => emojiCover('⚡', '#1a4a3a', '#0a3a2a', '反应测试', '变绿即点 · 测毫秒数'),
  '数字华容道': () => emojiCover('🔢', '#3a1a2a', '#4a2a3a', '数字华容道', '滑动还原 · 1 到 15'),
  '打地鼠': () => emojiCover('🔨', '#3a3a1a', '#4a4a2a', '打地鼠', '快速敲打 · 金鼠加倍'),
  '坦克大战': () => emojiCover('🎮', '#3a1a1a', '#4a2a2a', '坦克大战', '消灭敌军 · 利用掩体'),
  '颜色反应': () => emojiCover('🎨', '#2a1a3a', '#3a2a4a', '颜色反应', '认颜色不认字 · 抗干扰')
}

async function main () {
  await initDatabaseModels(true)

  const titles = Object.keys(GENERATORS)
  const games = await GameModel.findAll({ where: { title: titles } })

  if (!games.length) {
    console.log('✗ 未找到经典游戏记录，请先运行 seed-classic-games。')
    return
  }

  for (const game of games) {
    const gen = GENERATORS[game.title]
    if (!gen) continue

    if (game.coverPath && !FORCE) {
      console.log(`→ 《${game.title}》已有封面，跳过（--force 可覆盖）`)
      continue
    }

    console.log(`→ 生成《${game.title}》封面...`)
    const svg = Buffer.from(gen())
    const png = await sharp(svg, { density: 144 }).png().toBuffer()

    const stored = await storeGameCover({
      root: CONFIG.STORAGE.GAMES_DIR,
      filename: 'cover.png',
      mimeType: 'image/png',
      content: png
    })

    game.coverPath = stored.relativePath
    await game.save()
    console.log(`   ✓ ${stored.relativePath} (${(png.length / 1024).toFixed(1)} KB)`)
  }

  console.log('\n✅ 封面生成完成。')
  await sequelizeTypescript.close()
}

main().catch(err => {
  console.error('✗ 失败：', err)
  process.exit(1)
})
