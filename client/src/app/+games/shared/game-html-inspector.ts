/**
 * 纯前端 HTML 游戏内容探测器。
 *
 * 投稿时只上传 HTML 文件也能自动补充全部元信息,让作者尽量不用手动填写:
 *  - 标题:优先 <title>。
 *  - 简介:优先 <meta name="description">,降级到可见文案摘要。
 *  - 操作说明:优先 <meta name="gamehub-instructions">,降级到按键/鼠标/触屏事件扫描。
 *  - 分类:根据标题/简介/代码特征做关键词匹配。
 *  - 标签:优先 <meta name="keywords">,降级到从标题提取有意义词汇。
 *
 * 所有解析仅做只读扫描(DOMParser 在内存中解析,正则不执行任何脚本),
 * 不向文档注入内容,不访问网络。
 */

/** 探测结果。所有字段均为 null 时表示 HTML 没有可提取的有效信息。 */
export interface GameHtmlInspection {
  /** <title> 文本(已规整,可能为空 → null)。 */
  title: string | null
  /** 简介(meta description 或可见文案摘要)。 */
  description: string | null
  /** 操作说明(meta 标注原文或按键扫描生成的草稿)。 */
  instructions: string | null
  /** 推测的分类 ID(arcade/puzzle/...);无法判断时为 null。 */
  category: string | null
  /** 推测的标签数组;无可提取内容时为 null。 */
  tags: string[] | null
  /** 给作者看的「这里是怎么来的」提示,null 时不展示提示条。 */
  detectionNote: string | null
}

/** GameHub 约定的操作说明 meta 名(按优先级排列)。 */
const INSTRUCTION_META_NAMES = [ 'gamehub-instructions', 'instructions', 'controls' ]

/** GameHub 约定的简介 meta 名(按优先级排列)。 */
const DESCRIPTION_META_NAMES = [ 'gamehub-description', 'description' ]

/** GameHub 约定的关键词 meta 名(按优先级排列)。 */
const KEYWORDS_META_NAMES = [ 'gamehub-keywords', 'keywords' ]

/** 分类关键词映射,按匹配优先级排列(越靠前优先级越高)。 */
const CATEGORY_KEYWORDS: readonly { category: string, keywords: readonly string[] }[] = [
  {
    category: 'horror',
    keywords: [
      'horror', '恐怖', '惊悚', 'scary', 'creepy', 'survival horror',
      '暗黑', 'blood', '鬼', 'ghost', 'evil', '恶魔', 'nightmare', '噩梦',
      'sanity', '理智'
    ]
  },
  {
    category: 'rpg',
    keywords: [
      'rpg', 'roguelike', 'roguelite', '角色扮演', 'dungeon', '地牢',
      'level up', '升级', '经验', 'exp', 'skill tree', '技能树',
      'equipment', '装备', 'inventory', '背包', 'vitality', 'stamina', 'mana'
    ]
  },
  { category: 'puzzle', keywords: [ 'puzzle', '解谜', 'sokoban', '推箱子', 'match-3', '三消', '消除', 'logic', '逻辑' ] },
  { category: 'shooter', keywords: [ 'shooter', '射击', 'fps', 'bullet hell', '弹幕', 'aim', '瞄准' ] },
  { category: 'racing', keywords: [ 'racing', '竞速', 'race', '赛车', 'drift', '漂移', '赛道', 'lap' ] },
  { category: 'music', keywords: [ 'rhythm game', '节奏', '音游', '音律', 'beatmap', 'piano', '钢琴', 'drum', '鼓' ] },
  { category: 'sports', keywords: [ 'sports', '体育', '足球', '篮球', 'football', 'basketball', 'soccer', 'tennis', '网球', 'boxing', '拳击' ] },
  { category: 'strategy', keywords: [ 'strategy', '策略', 'tower defense', '塔防', 'chess', '棋', '战争' ] },
  { category: 'card', keywords: [ 'card game', '卡牌', '纸牌', '扑克', 'poker', 'tcg', 'ccg', 'solitaire' ] },
  { category: 'board', keywords: [ 'board game', '桌游', '棋盘', 'gomoku', '五子棋', 'reversi', '黑白棋', '迷宫' ] },
  { category: 'simulation', keywords: [ 'simulation', '模拟', 'simulator', 'tycoon', '大亨', 'farm', '农场' ] },
  { category: 'sandbox', keywords: [ 'sandbox', '沙盒', 'minecraft', 'voxel', '体素' ] },
  { category: 'arcade', keywords: [ 'arcade', '动作', 'action', 'platformer', '平台', 'jump', '跳跃', 'ninja', '忍者', '格斗' ] }
]

/** 停用词,从标签提取时过滤掉。 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'for', 'is', 'are',
  'game', 'games', 'play', 'demo', 'test', 'html5', 'canvas', 'webgl', 'js',
  'with', 'from', 'by', 'this', 'that', 'it'
])

/**
 * 解析 HTML 文本,提取标题、简介、操作说明、分类、标签等信息。
 *
 * 不会抛出异常:任何解析失败都降级为返回空字段,保证投稿流程不被阻塞。
 */
export function inspectGameHtml (source: string): GameHtmlInspection {
  if (!source || typeof source !== 'string') {
    return { title: null, description: null, instructions: null, category: null, tags: null, detectionNote: null }
  }

  const document = parseHtmlDocument(source)
  const primaryHaystack = buildPrimaryHaystack(document)
  const fullHaystack = buildKeywordHaystack(document, source)

  const title = extractTitle(document, source)
  const description = extractDescription(document, source, title)
  const category = detectCategory(primaryHaystack, fullHaystack)
  const tags = extractTags(document, title, primaryHaystack)
  const { instructions, instructionsFromMeta } = extractInstructions(document, source)

  const detectionNote = buildDetectionNote({ instructionsFromMeta, hasCategory: !!category, hasTags: !!tags?.length })

  return { title, description, instructions, category, tags, detectionNote }
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

function parseHtmlDocument (source: string): Document | null {
  // 浏览器 DOMParser 在内存中解析,不会执行脚本或注入 DOM
  if (typeof DOMParser !== 'undefined') {
    try {
      return new DOMParser().parseFromString(source, 'text/html')
    } catch {
      // 降级到正则提取
    }
  }
  return null
}

function extractTitle (document: Document | null, source: string): string | null {
  const raw = document?.querySelector('title')?.textContent ??
    source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    ''

  return normalizeWhitespace(raw)
}

function extractDescription (document: Document | null, source: string, title: string | null): string | null {
  // 优先读 meta description
  const meta = readMetaContent(document, DESCRIPTION_META_NAMES)
  if (meta) return meta

  // 降级:取首个可见的 <p> 或 <h1> 文本作为简介摘要
  const visibleText = extractFirstVisibleText(document, source)
  if (visibleText) return visibleText

  // 再降级:用标题生成一句默认简介
  if (title) return `${title} —— 一款 GameHub 网页小游戏`

  return null
}

function extractFirstVisibleText (document: Document | null, source: string): string | null {
  if (document) {
    // 优先取描述性段落,跳过导航/按钮文案
    const candidate = document.querySelector('article p, main p, p, h1, h2')?.textContent
    const normalized = normalizeWhitespace(candidate || '')
    // 过滤掉太短(可能是按钮文案)或太长(可能是整页正文)的内容
    if (normalized && normalized.length >= 8 && normalized.length <= 200) return normalized
  }

  // 正则降级:取首个 <p> 标签内容
  const match = source.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)
  if (match) {
    const normalized = normalizeWhitespace(stripTags(match[1]))
    if (normalized && normalized.length >= 8 && normalized.length <= 200) return normalized
  }

  return null
}

/** 把标题、meta、可见文案拼成一个用于关键词匹配的小写字符串。 */
/** 高置信度文本:标题 + meta description + meta keywords。用于分类/标签优先匹配。 */
function buildPrimaryHaystack (document: Document | null): string {
  const parts: string[] = []

  const title = document?.querySelector('title')?.textContent
  if (title) parts.push(title)

  const description = readMetaContent(document, DESCRIPTION_META_NAMES)
  if (description) parts.push(description)

  const keywords = readMetaContent(document, KEYWORDS_META_NAMES)
  if (keywords) parts.push(keywords)

  return parts.join(' ').toLowerCase()
}

/** 全量文本:高置信度文本 + body 可见文案。用于分类降级匹配。 */
function buildKeywordHaystack (document: Document | null, source: string): string {
  const primary = buildPrimaryHaystack(document)
  const bodyText = extractBodyText(document, source)
  if (bodyText) return (primary + ' ' + bodyText.slice(0, 2000)).toLowerCase()
  return primary
}

function extractBodyText (document: Document | null, source: string): string {
  if (document) {
    const body = document.body?.textContent || ''
    return stripTags(body)
  }
  // 正则降级:粗略提取 <body> 内的纯文本
  const bodyMatch = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return bodyMatch ? stripTags(bodyMatch[1]) : ''
}

function detectCategory (primaryHaystack: string, fullHaystack: string): string | null {
  // 优先只看标题+meta(更可靠);命中即返回,避免 body 噪音误判
  const primary = scoreCategory(primaryHaystack)
  if (primary) return primary

  // 降级:看 body 可见文案
  return scoreCategory(fullHaystack)
}

function scoreCategory (haystack: string): string | null {
  if (!haystack) return null

  let bestCategory: string | null = null
  let bestScore = 0

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    let score = 0
    for (const keyword of keywords) {
      if (haystack.includes(keyword.toLowerCase())) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestCategory
}

function extractTags (document: Document | null, title: string | null, haystack: string): string[] | null {
  // 优先读 meta keywords
  const metaKeywords = readMetaContent(document, KEYWORDS_META_NAMES)
  if (metaKeywords) {
    const tags = metaKeywords
      .split(/[,，、\s]+/)
      .map(t => t.trim())
      .filter(t => t.length >= 2 && t.length <= 20)
      .slice(0, 5)
    if (tags.length) return tags
  }

  // 降级:从标题里提取有意义的英文词汇作为标签
  if (title) {
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .map(w => w.trim())
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    const unique = Array.from(new Set(words)).slice(0, 3)
    if (unique.length) return unique
  }

  return null
}

function extractInstructions (document: Document | null, source: string): { instructions: string | null, instructionsFromMeta: boolean } {
  // 操作说明:优先 meta 标注 → 降级按键扫描
  const metaInstructions = readMetaContent(document, INSTRUCTION_META_NAMES)
  if (metaInstructions) {
    return { instructions: metaInstructions, instructionsFromMeta: true }
  }

  const scanned = scanInputEvents(source)
  return { instructions: scanned, instructionsFromMeta: false }
}

function buildDetectionNote (info: { instructionsFromMeta: boolean, hasCategory: boolean, hasTags: boolean }): string | null {
  const parts: string[] = []
  if (info.instructionsFromMeta) {
    parts.push('操作说明来自 meta 标注')
  }
  if (info.hasCategory) {
    parts.push('分类为自动推测')
  }
  if (info.hasTags) {
    parts.push('标签为自动提取')
  }

  if (parts.length === 0) return null
  return '已从 HTML 自动识别：' + parts.join('，') + '，可直接提交或按需修改'
}

/** 扫描源码中的按键 / 鼠标 / 触屏事件,拼出中文操作草稿;无可识别信号时返回 null。 */
function scanInputEvents (source: string): string | null {
  const hasKeyboardListener = /\baddEventListener\s*\(\s*['"]key(?:down|up|press)['"]/i.test(source)
  const hasMouseListener = /\baddEventListener\s*\(\s*['"](?:mouse(?:down|up|move)|click)['"]/i.test(source)
  const hasTouchListener = /\baddEventListener\s*\(\s*['"]touch(?:start|move|end)['"]/i.test(source)

  const keys = detectKeyCodes(source)
  const mouseSignal = hasMouseListener || /\b(?:mouse(?:X|Y|Down|Up|Move)|clientX|clientY)\b/.test(source)
  const touchSignal = hasTouchListener || /\btouch(?:es|start|move|end)\b/.test(source)
  const hasKeyboardSignal = hasKeyboardListener || keys.any

  const fragments: string[] = []
  if (keys.wasd) fragments.push('WASD 移动')
  if (keys.arrows) fragments.push('方向键移动')
  if (keys.space) fragments.push('空格确认 / 跳跃')
  if (keys.enter) fragments.push('回车确认')
  if (keys.shift) fragments.push('Shift 辅助')
  if (keys.control) fragments.push('Ctrl 辅助')
  if (mouseSignal) fragments.push('鼠标操作')
  if (touchSignal) fragments.push('支持触屏')

  // 没有任何输入信号时不生成草稿(避免误导)
  if (fragments.length === 0 && !hasKeyboardSignal && !mouseSignal && !touchSignal) {
    return null
  }

  // 有事件监听但未识别出具体按键时给出通用提示
  if (fragments.length === 0) {
    if (hasKeyboardSignal) fragments.push('键盘操作')
    if (mouseSignal) fragments.push('鼠标操作')
    if (touchSignal) fragments.push('触屏操作')
  }

  return fragments.join('，') || null
}

interface KeyCodeDetection {
  wasd: boolean
  arrows: boolean
  space: boolean
  enter: boolean
  shift: boolean
  control: boolean
  any: boolean
}

/** 识别源码中引用的 KeyboardEvent.code / .key 值。 */
function detectKeyCodes (source: string): KeyCodeDetection {
  // 匹配形如: case 'KeyW': / e.code === 'KeyW' / 'KeyW' 等
  const keyCodePattern = [
    'Key[A-Z]',
    'Arrow[A-Z][a-z]*',
    'Space',
    'Enter',
    'Shift(?:Left|Right)?',
    'Control(?:Left|Right)?',
    'Tab',
    'Escape'
  ].join('|')
  const codeMatches = source.match(new RegExp(`['"](?:${keyCodePattern})['"]`, 'g')) || []
  const codes = new Set(codeMatches.map(m => m.replace(/['"]/g, '')))
  // 兼容 e.key === ' ' 这类空格判断(单空格字符串字面量与 key 属性同时出现)
  const spaceKey = /\.key\b/.test(source) && /['"]\s['"]/.test(source)

  return {
    wasd: codes.has('KeyW') || codes.has('KeyA') || codes.has('KeyS') || codes.has('KeyD'),
    arrows: codes.has('ArrowUp') || codes.has('ArrowDown') || codes.has('ArrowLeft') || codes.has('ArrowRight'),
    space: codes.has('Space') || spaceKey,
    enter: codes.has('Enter'),
    shift: codes.has('Shift') || codes.has('ShiftLeft') || codes.has('ShiftRight'),
    control: codes.has('Control') || codes.has('ControlLeft') || codes.has('ControlRight'),
    any: codes.size > 0 || spaceKey
  }
}

function readMetaContent (document: Document | null, names: readonly string[]): string | null {
  if (!document) return null

  for (const name of names) {
    const selector = `meta[name="${cssEscape(name)}" i]`
    const content = document.querySelector(selector)?.getAttribute('content')
    const normalized = normalizeWhitespace(content || '')
    if (normalized) return normalized
  }
  return null
}

function normalizeWhitespace (value: string): string | null {
  if (!value) return null
  const normalized = value
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)

  return normalized || null
}

function stripTags (html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cssEscape (value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\\]]/g, '\\$&')
}
