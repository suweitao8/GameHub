import { createHash, randomUUID } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { basename, extname, join, relative, resolve, sep } from 'path'
import { parse } from 'node-html-parser'

export const DEFAULT_GAME_MAX_FILE_SIZE_BYTES = 1024 * 1024

type GameHtmlInput = {
  filename: string
  mimeType?: string
  content: Buffer
  maxFileSizeBytes?: number
}

type ValidatedGameHtml = {
  content: Buffer
  runtimeSha256: string
  fileSizeBytes: number
}

type StoredGameHtml = ValidatedGameHtml & {
  absolutePath: string
  relativePath: string
}

export type StoredGameCover = {
  absolutePath: string
  relativePath: string
  mimeType: string
}

export function validateSingleHtmlGame (input: GameHtmlInput): ValidatedGameHtml {
  const maxFileSizeBytes = input.maxFileSizeBytes ?? DEFAULT_GAME_MAX_FILE_SIZE_BYTES

  if (!input.filename || basename(input.filename) !== input.filename || ![ '.html', '.htm' ].includes(extname(input.filename).toLowerCase())) {
    throw new Error('Only a single HTML file is supported')
  }

  if (input.mimeType && ![ 'text/html', 'application/xhtml+xml' ].includes(input.mimeType.toLowerCase())) {
    throw new Error('Only a single HTML file is supported')
  }

  if (!Buffer.isBuffer(input.content) || input.content.length === 0) {
    throw new Error('Game file cannot be empty')
  }

  if (input.content.length > maxFileSizeBytes) {
    throw new Error('Game file is too large')
  }

  const html = input.content.toString('utf8')
  if (html.includes('\u0000')) throw new Error('Game file contains an invalid character')

  validateMarkupResources(html)
  validateInlineCode(html)

  return {
    content: input.content,
    runtimeSha256: createHash('sha256').update(input.content).digest('hex'),
    fileSizeBytes: input.content.length
  }
}

export async function storeSingleHtmlGame (input: GameHtmlInput & { root: string }): Promise<StoredGameHtml> {
  const validated = validateSingleHtmlGame(input)
  const rootPath = resolve(input.root)
  await mkdir(rootPath, { recursive: true })

  const runtimeDirectory = join(rootPath, randomUUID())
  const absolutePath = join(runtimeDirectory, 'index.html')
  const relativePath = relative(rootPath, absolutePath).split(sep).join('/')

  if (!isPathInside(rootPath, absolutePath)) throw new Error('Game runtime path escapes storage root')

  try {
    await mkdir(runtimeDirectory)
    await writeFile(absolutePath, validated.content, { flag: 'wx', mode: 0o600 })
  } catch (err) {
    await rm(runtimeDirectory, { recursive: true, force: true })
    throw err
  }

  return { ...validated, absolutePath, relativePath }
}

export async function storeGameCover (input: { root: string; filename: string; mimeType: string; content: Buffer }): Promise<StoredGameCover> {
  const extension = extname(basename(input.filename)).toLowerCase()
  const mimeType = input.mimeType.toLowerCase()
  const supported = new Map([ [ '.png', 'image/png' ], [ '.jpg', 'image/jpeg' ], [ '.jpeg', 'image/jpeg' ], [ '.webp', 'image/webp' ] ])
  if (supported.get(extension) !== mimeType || input.content.length === 0 || input.content.length > 2 * 1024 * 1024) {
    throw new Error('Cover must be a non-empty PNG, JPEG, or WebP image smaller than 2 MB')
  }

  const rootPath = resolve(input.root)
  const coverDirectory = join(rootPath, 'covers', randomUUID())
  const absolutePath = join(coverDirectory, `cover${extension}`)
  if (!isPathInside(rootPath, absolutePath)) throw new Error('Game cover path escapes storage root')

  await mkdir(coverDirectory, { recursive: true })
  try {
    await writeFile(absolutePath, input.content, { flag: 'wx', mode: 0o600 })
  } catch (err) {
    await rm(coverDirectory, { recursive: true, force: true })
    throw err
  }

  return { absolutePath, relativePath: relative(rootPath, absolutePath).split(sep).join('/'), mimeType }
}

export async function readStoredGameHtml (root: string, runtimePath: string) {
  const rootPath = resolve(root)
  const absolutePath = resolve(rootPath, runtimePath)

  if (!isPathInside(rootPath, absolutePath) || basename(absolutePath) !== 'index.html') {
    throw new Error('Invalid game runtime path')
  }

  return readFile(absolutePath)
}

export async function readStoredGameCover (root: string, coverPath: string) {
  const rootPath = resolve(root)
  const absolutePath = resolve(rootPath, coverPath)
  if (!isPathInside(rootPath, absolutePath) || !coverPath.startsWith('covers/')) throw new Error('Invalid game cover path')
  return readFile(absolutePath)
}

export function getGameRuntimeHeaders (parentOrigin: string | string[]): Record<string, string> {
  const origins = (Array.isArray(parentOrigin) ? parentOrigin : [ parentOrigin ])
    .map(origin => new URL(origin).origin)

  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      'img-src data: blob:',
      'media-src data: blob:',
      'font-src data: blob:',
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      `frame-ancestors ${origins.join(' ')}`,
      "navigate-to 'none'"
    ].join('; ')
  }
}

function validateMarkupResources (html: string) {
  const document = parse(html, { lowerCaseTagName: true })

  for (const element of document.querySelectorAll('script,link,img,audio,video,source,iframe,object')) {
    const tagName = element.tagName.toLowerCase()
    const attribute = tagName === 'object' ? 'data' : tagName === 'link' ? 'href' : 'src'
    const value = element.getAttribute(attribute)

    if (!value) continue
    if (tagName === 'script' || !isInlineResource(value)) {
      throw new Error('External resources are not supported')
    }
  }

  for (const element of document.querySelectorAll('a,form')) {
    const attribute = element.tagName.toLowerCase() === 'form' ? 'action' : 'href'
    const value = element.getAttribute(attribute)

    if (value && value !== '#' && value !== '') throw new Error('Navigation and forms are not supported')
  }
}

function validateInlineCode (html: string) {
  const forbiddenPatterns = [
    /\bfetch\s*\(/i,
    /\bXMLHttpRequest\b/i,
    /\bWebSocket\b/i,
    /\bnavigator\.sendBeacon\s*\(/i,
    /\bwindow\.(?:open|top|parent)\b/i,
    /\b(?:window\.)?(?:top|parent)\.location\b/i
  ]

  if (forbiddenPatterns.some(pattern => pattern.test(html))) {
    throw new Error('Network and top-level navigation APIs are not supported')
  }
}

function isInlineResource (value: string) {
  return /^(?:data:|blob:|#)/i.test(value.trim())
}

function isPathInside (rootPath: string, childPath: string) {
  const relativePath = relative(rootPath, childPath)
  return relativePath !== '' && !relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !relativePath.includes(`${sep}..${sep}`)
}
