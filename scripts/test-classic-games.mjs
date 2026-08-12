import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const gamesDir = join(root, 'packages', 'games', 'classic')
const seedSource = readFileSync(join(root, 'server', 'scripts', 'seed-classic-games.ts'), 'utf8')
const coverSource = readFileSync(join(root, 'server', 'scripts', 'generate-classic-covers.ts'), 'utf8')

const expectedGames = [
  [ 'snake.html', '贪吃蛇' ],
  [ 'tetris.html', '俄罗斯方块' ],
  [ 'breakout.html', '打砖块' ],
  [ 'flappy.html', '像素鸟' ],
  [ '2048.html', '2048' ],
  [ 'pong.html', '乒乓' ],
  [ 'minesweeper.html', '扫雷' ],
  [ 'gomoku.html', '五子棋' ],
  [ 'pacman.html', '吃豆人' ],
  [ 'asteroids.html', '太空射击' ],
  [ 'memory.html', '记忆翻牌' ],
  [ 'sokoban.html', '推箱子' ],
  [ 'tictactoe.html', '井字棋' ],
  [ 'stack.html', '堆方块' ],
  [ 'jump.html', '跳一跳' ],
  [ 'reaction.html', '反应测试' ],
  [ 'puzzle15.html', '数字华容道' ],
  [ 'whack.html', '打地鼠' ],
  [ 'tank.html', '坦克大战' ],
  [ 'stroop.html', '颜色反应' ],
  [ 'space-invaders.html', '太空入侵者' ],
  [ 'connect-four.html', '四子棋' ],
  [ 'reversi.html', '黑白棋' ],
  [ 'checkers.html', '国际跳棋' ],
  [ 'sudoku.html', '数独' ],
  [ 'simon.html', '记忆序列' ],
  [ 'frogger.html', '青蛙过河' ],
  [ 'bubble-shooter.html', '泡泡龙' ],
  [ 'blackjack.html', '纸牌 21 点' ],
  [ 'hangman.html', '猜单词' ]
]

const seedFiles = [ ...seedSource.matchAll(/file: '([^']+)'/g) ].map(match => match[1])
assert.equal(seedFiles.length, 30, '经典游戏种子必须恰好发布 30 款游戏')
assert.equal(new Set(seedFiles).size, 30, '经典游戏种子文件名不能重复')
assert.deepEqual(seedFiles, expectedGames.map(([ file ]) => file), '经典游戏种子顺序必须和官方目录一致')

const packagedFiles = readdirSync(gamesDir).filter(file => file.endsWith('.html')).sort()
assert.deepEqual(
  packagedFiles,
  expectedGames.map(([ file ]) => file).sort(),
  '经典游戏目录必须和种子目录精确一致'
)

for (const [ file, title ] of expectedGames) {
  const spec = new RegExp(`file: '${file.replace('.', '\\.')}'[\\s\\S]*?title: '${title}'`)
  assert.match(seedSource, spec, `种子必须为《${title}》注册正确的运行包`)
  assert.ok(coverSource.includes(`'${title}':`), `《${title}》必须有独立封面生成器`)

  const html = readFileSync(join(gamesDir, file), 'utf8')
  assert.match(html, /^<!doctype html>/i, `${file} 必须是完整 HTML 文档`)
  assert.match(html, /<meta name="gamehub-description"/i, `${file} 必须提供游戏描述`)
  assert.match(html, /<meta name="gamehub-instructions"/i, `${file} 必须提供操作说明`)
  assert.match(html, /id="startBtn"|^\s*reset\(\);/m, `${file} 必须提供开始按钮或自动开局入口`)
  assert.match(html, /id="retryBtn"|addEventListener\('dblclick'.*reset\(/, `${file} 必须提供重新开始入口`)
  assert.match(html, /<script>/i, `${file} 必须包含自包含运行逻辑`)
  assert.doesNotMatch(html, /<script[^>]+\ssrc=/i, `${file} 不能依赖外部脚本`)
  assert.doesNotMatch(html, /https?:\/\//i, `${file} 不能依赖外部网络资源`)
  assert.doesNotMatch(html, /\b(?:localStorage|sessionStorage)\b/i, `${file} 不能使用被运行时沙箱禁止的持久化 API`)
  assert.match(html, /data-gamehub-audio="v1"/, `${file} 必须包含统一音频运行时标记`)
  assert.match(html, /id="gamehubAudioControls"/, `${file} 必须提供音频控制区域`)
  assert.match(html, /data-audio="music"[^>]+aria-pressed/, `${file} 必须提供音乐开关`)
  assert.match(html, /data-audio="sfx"[^>]+aria-pressed/, `${file} 必须提供音效开关`)
  assert.match(html, /AudioContext|webkitAudioContext/, `${file} 必须使用自包含 Web Audio 音频引擎`)
  assert.match(html, /try\{audioContext=new AudioContextCtor\(\)/, `${file} 必须在 Web Audio 不可用时优雅降级`)
  assert.match(html, /function ensureAudio\(/, `${file} 必须在用户操作后初始化音频上下文`)
  assert.match(html, /function startMusic\(/, `${file} 必须提供背景音乐循环`)
  assert.match(html, /function sfx\(/, `${file} 必须提供动作音效入口`)
  assert.match(html, /addEventListener\('pointerdown'/, `${file} 必须响应触控或鼠标操作播放音效`)
  assert.match(html, /addEventListener\('keydown'/, `${file} 必须响应键盘操作播放音效`)
  assert.match(html, /visibilitychange/, `${file} 必须在页面切后台时处理音乐状态`)
  assert.match(html, /MutationObserver/, `${file} 必须为结果状态提供反馈音效`)
  assert.match(html, /const scoreNodes=/, `${file} 必须只观察分数类节点触发得分音效`)
  assert.match(html, /const resultVisible=/, `${file} 必须只在结果层显示时触发胜负音效`)
  assert.match(html, /mistakeChanged/, `${file} 必须为失误提供独立音效反馈`)
}

const sudokuHtml = readFileSync(join(gamesDir, 'sudoku.html'), 'utf8')
const sudokuGivens = sudokuHtml.match(/givens=new Set\(\[([^\]]+)\]\)/)
const sudokuProgress = sudokuHtml.match(/id="filled">0 \/ (\d+)</)
assert.ok(sudokuGivens, '数独必须声明固定题目的初始数字')
assert.ok(sudokuProgress, '数独必须声明初始待填格数量')
assert.equal(
  Number(sudokuProgress[1]),
  81 - sudokuGivens[1].split(',').filter(Boolean).length,
  '数独初始待填格数量必须和实际题面一致'
)

const bubbleHtml = readFileSync(join(gamesDir, 'bubble-shooter.html'), 'utf8')
assert.match(
  bubbleHtml,
  /function attachmentCell\(p\)\{if\(p\.r>12\)return null;if\(!occupied\(p\.r,p\.q\)\)return p;/,
  '泡泡龙命中已占格时必须寻找可贴附的相邻空格'
)
assert.match(
  bubbleHtml,
  /function attach\(\)\{const p=attachmentCell\(cellAt\(shot\.x,shot\.y\)\);if\(!p\)\{shot=null;return finish\(false\)\}/,
  '泡泡龙无法贴附时必须结束本局，不能让发射泡泡永久卡住'
)

const reversiHtml = readFileSync(join(gamesDir, 'reversi.html'), 'utf8')
assert.match(
  reversiHtml,
  /function continueTurn\(\)\{if\(!moves\(turn\)\.length\)\{turn=3-turn;if\(!moves\(turn\)\.length\)return finish\(\);[^}]+\}if\(turn===1\)\{locked=false;render\(\);return\}locked=true;render\(\);setTimeout\(ai,400\)\}/,
  '黑白棋跳过无合法步后必须恢复玩家回合或继续电脑回合'
)
assert.match(
  reversiHtml,
  /if\(!list\.length\)\{turn=1;continueTurn\(\);return\}/,
  '黑白棋电脑无合法步时必须通过统一回合流转解除锁定'
)
assert.doesNotMatch(
  reversiHtml,
  /if\(!list\.length\)\{turn=1;advance\(\);render\(\);return\}/,
  '黑白棋不能在电脑跳过后保持锁定状态'
)

console.log(`classic games contract OK: ${expectedGames.length} playable packages`)
