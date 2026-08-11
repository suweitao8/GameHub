/**
 * 纯前端 HTML 游戏内容探测器。
 *
 * 投稿时只上传 HTML 文件也能自动补充元信息:
 *  - 标题优先取 <title>。
 *  - 操作说明优先读 GameHub 约定的 <meta name="gamehub-instructions">,缺失时
 *    扫描源码中的按键 / 鼠标 / 触屏事件,生成中文草稿供作者确认或修改。
 *
 * 所有解析仅做只读扫描(DOMParser 在内存中解析,正则不执行任何脚本),
 * 不向文档注入内容,不访问网络。
 */

/** 探测结果。所有字段均为 null 时表示 HTML 没有可提取的有效信息。 */
export interface GameHtmlInspection {
  /** <title> 文本(已规整,可能为空 → null)。 */
  title: string | null
  /** 操作说明(meta 标注原文或按键扫描生成的草稿)。 */
  instructions: string | null
  /** 给作者看的「这里是怎么来的」提示,null 时不展示提示条。 */
  detectionNote: string | null
  /** <meta name="gamehub-description"> 原文,本期不回填表单,预留扩展。 */
  description: string | null
}

/** GameHub 约定的操作说明 meta 名(按优先级排列)。 */
const INSTRUCTION_META_NAMES = [ 'gamehub-instructions', 'instructions', 'controls' ]

/** GameHub 约定的简介 meta 名(按优先级排列)。 */
const DESCRIPTION_META_NAMES = [ 'gamehub-description', 'description' ]

/**
 * 解析 HTML 文本,提取标题、操作说明等信息。
 *
 * 不会抛出异常:任何解析失败都降级为返回空字段,保证投稿流程不被阻塞。
 */
export function inspectGameHtml (source: string): GameHtmlInspection {
  if (!source || typeof source !== 'string') {
    return { title: null, instructions: null, detectionNote: null, description: null }
  }

  const document = parseHtmlDocument(source)
  const title = extractTitle(document, source)
  const description = readMetaContent(document, DESCRIPTION_META_NAMES)

  // 操作说明:优先 meta 标注 → 降级按键扫描
  const metaInstructions = readMetaContent(document, INSTRUCTION_META_NAMES)
  if (metaInstructions) {
    return { title, description, instructions: metaInstructions, detectionNote: '已从 HTML 的 meta 标注读取操作说明' }
  }

  const scanned = scanInputEvents(source)
  if (scanned) {
    return { title, description, instructions: scanned, detectionNote: '已根据游戏按键事件自动生成操作草稿,请确认或修改' }
  }

  return { title, description, instructions: null, detectionNote: null }
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

function cssEscape (value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\\]]/g, '\\$&')
}
