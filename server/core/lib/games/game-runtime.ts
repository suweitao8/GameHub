import { createHash, randomUUID } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { basename, extname, join, relative, resolve, sep, posix } from 'path'
import { parse } from 'node-html-parser'

export const DEFAULT_GAME_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

const ALLOWED_RUNTIME_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
  '.mp3', '.wav', '.ogg', '.m4a', '.woff', '.woff2', '.ttf', '.otf'
])

const RUNTIME_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}

type GameRuntimeInput = {
  filename: string
  mimeType?: string
  content: Buffer
  maxFileSizeBytes?: number
}

type ValidatedHtml = {
  content: Buffer
  runtimeSha256: string
  fileSizeBytes: number
}

export type StoredGameRuntimePackage = {
  absoluteDirectory: string
  absolutePath: string
  relativePath: string
  runtimeSha256: string
  fileSizeBytes: number
  fileCount: number
}

export type StoredGameCover = {
  absolutePath: string
  relativePath: string
  mimeType: string
}

export class GameRuntimeValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'GameRuntimeValidationError'
  }
}

export function validateSingleHtmlGame (input: GameRuntimeInput): ValidatedHtml {
  const maxFileSizeBytes = input.maxFileSizeBytes ?? DEFAULT_GAME_MAX_FILE_SIZE_BYTES

  if (!input.filename || basename(input.filename) !== input.filename || ![ '.html', '.htm' ].includes(extname(input.filename).toLowerCase())) {
    throw new GameRuntimeValidationError('Only a single HTML file is supported')
  }

  if (!Buffer.isBuffer(input.content) || input.content.length === 0) {
    throw new GameRuntimeValidationError('Game file cannot be empty')
  }

  if (input.content.length > maxFileSizeBytes) {
    throw new GameRuntimeValidationError('Game file is too large')
  }

  validateHtmlContent(input.content.toString('utf8'), 'index.html')

  return {
    content: input.content,
    runtimeSha256: createHash('sha256').update(input.content).digest('hex'),
    fileSizeBytes: input.content.length
  }
}

export async function storeSingleHtmlGame (input: GameRuntimeInput & { root: string }): Promise<StoredGameRuntimePackage> {
  return storeGameRuntimePackage(input)
}

export async function storeGameRuntimePackage (input: GameRuntimeInput & { root: string; directoryName?: string }): Promise<StoredGameRuntimePackage> {
  const rootPath = resolve(input.root)
  const maxFileSizeBytes = input.maxFileSizeBytes ?? DEFAULT_GAME_MAX_FILE_SIZE_BYTES
  const runtimeDirectory = join(rootPath, input.directoryName || cryptoRandomDirectoryName())
  const validated = validateSingleHtmlGame({ ...input, maxFileSizeBytes })
  return writeRuntimeFiles({
    rootPath,
    runtimeDirectory,
    files: new Map([ [ 'index.html', validated.content ] ]),
    runtimeSha256: validated.runtimeSha256
  })
}

export async function readStoredGameHtml (root: string, runtimePath: string) {
  if (basename(runtimePath) !== 'index.html') throw new GameRuntimeValidationError('Invalid game runtime path')
  return readStoredGameRuntimeFile(root, runtimePath)
}

export async function readStoredGameRuntimeFile (root: string, runtimePath: string) {
  const rootPath = resolve(root)
  const absolutePath = resolve(rootPath, runtimePath)
  const extension = extname(absolutePath).toLowerCase()

  if (!isPathInside(rootPath, absolutePath) || !ALLOWED_RUNTIME_EXTENSIONS.has(extension)) {
    throw new GameRuntimeValidationError('Invalid game runtime path')
  }

  return readFile(absolutePath)
}

export function getGameRuntimeMimeType (runtimePath: string) {
  return RUNTIME_MIME_TYPES[extname(runtimePath).toLowerCase()] || 'application/octet-stream'
}

export async function storeGameCover (input: { root: string; filename: string; mimeType: string; content: Buffer }): Promise<StoredGameCover> {
  const extension = extname(basename(input.filename)).toLowerCase()
  const mimeType = input.mimeType.toLowerCase()
  const supported = new Map([ [ '.png', 'image/png' ], [ '.jpg', 'image/jpeg' ], [ '.jpeg', 'image/jpeg' ], [ '.webp', 'image/webp' ] ])
  if (supported.get(extension) !== mimeType || input.content.length === 0 || input.content.length > 2 * 1024 * 1024) {
    throw new GameRuntimeValidationError('Cover must be a non-empty PNG, JPEG, or WebP image smaller than 2 MB')
  }

  const rootPath = resolve(input.root)
  const coverDirectory = join(rootPath, 'covers', cryptoRandomDirectoryName())
  const absolutePath = join(coverDirectory, `cover${extension}`)
  if (!isPathInside(rootPath, absolutePath)) throw new GameRuntimeValidationError('Game cover path escapes storage root')

  await mkdir(coverDirectory, { recursive: true })
  try {
    await writeFile(absolutePath, input.content, { flag: 'wx', mode: 0o600 })
  } catch (err) {
    await rm(coverDirectory, { recursive: true, force: true })
    throw err
  }

  return { absolutePath, relativePath: relative(rootPath, absolutePath).split(sep).join('/'), mimeType }
}

export async function readStoredGameCover (root: string, coverPath: string) {
  const rootPath = resolve(root)
  const absolutePath = resolve(rootPath, coverPath)
  if (!isPathInside(rootPath, absolutePath) || !coverPath.startsWith('covers/')) throw new GameRuntimeValidationError('Invalid game cover path')
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
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "font-src 'self' data: blob:",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      `frame-ancestors ${origins.join(' ')}`,
      "navigate-to 'none'"
    ].join('; ')
  }
}

async function writeRuntimeFiles (input: {
  rootPath: string
  runtimeDirectory: string
  files: Map<string, Buffer>
  runtimeSha256: string
}): Promise<StoredGameRuntimePackage> {
  if (!isPathInside(input.rootPath, input.runtimeDirectory)) throw new GameRuntimeValidationError('Game runtime path escapes storage root')

  const entryPath = join(input.runtimeDirectory, 'index.html')
  try {
    await mkdir(input.runtimeDirectory, { recursive: true })
    for (const [ path, content ] of input.files) {
      const absolutePath = resolve(input.runtimeDirectory, path)
      if (!isPathInside(input.runtimeDirectory, absolutePath)) throw new GameRuntimeValidationError('Game runtime path escapes storage root')
      await mkdir(resolve(absolutePath, '..'), { recursive: true })
      await writeFile(absolutePath, content, { flag: 'wx', mode: 0o600 })
    }
  } catch (err) {
    await rm(input.runtimeDirectory, { recursive: true, force: true }).catch(() => undefined)
    throw err
  }

  const relativePath = relative(input.rootPath, entryPath).split(sep).join('/')
  return {
    absoluteDirectory: input.runtimeDirectory,
    absolutePath: entryPath,
    relativePath,
    runtimeSha256: input.runtimeSha256,
    fileSizeBytes: Array.from(input.files.values()).reduce((total, content) => total + content.length, 0),
    fileCount: input.files.size
  }
}

function validateHtmlContent (html: string, currentPath: string, files?: Map<string, Buffer>) {
  if (html.includes('\u0000')) throw new GameRuntimeValidationError('Game file contains an invalid character')
  validateMarkupResources(html, currentPath, files)
  validateInlineCode(html)
}

function validateMarkupResources (html: string, currentPath: string, files?: Map<string, Buffer>) {
  const document = parse(html, { lowerCaseTagName: true })
  const allowRelative = !!files

  for (const element of document.querySelectorAll('script,link,img,audio,video,source,iframe,object')) {
    const tagName = element.tagName.toLowerCase()
    const attribute = tagName === 'object' ? 'data' : tagName === 'link' ? 'href' : 'src'
    const value = element.getAttribute(attribute)
    if (!value) continue
    validateResourceReference(value, currentPath, files, allowRelative)
  }

  for (const element of document.querySelectorAll('a,form')) {
    const attribute = element.tagName.toLowerCase() === 'form' ? 'action' : 'href'
    const value = element.getAttribute(attribute)
    if (value && value !== '#' && value !== '') throw new GameRuntimeValidationError('Navigation and forms are not supported')
  }

  for (const element of document.querySelectorAll('style')) validateCssContent(element.textContent, currentPath, files)
  for (const element of document.querySelectorAll('[style]')) validateCssContent(element.getAttribute('style') || '', currentPath, files)
}

function validateCssContent (css: string, currentPath: string, files?: Map<string, Buffer>) {
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
  for (const match of css.matchAll(urlPattern)) validateResourceReference(match[2], currentPath, files, true)
}

function validateResourceReference (value: string, currentPath: string, files: Map<string, Buffer> | undefined, allowRelative: boolean) {
  const trimmed = value.trim()
  if (!trimmed || /^(?:data:|blob:|#)/i.test(trimmed)) return
  if (!allowRelative || trimmed.includes('\\') || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(trimmed)) {
    throw new GameRuntimeValidationError('External resources are not supported')
  }

  const path = trimmed.split(/[?#]/, 1)[0]
  const resolved = posix.normalize(posix.join(posix.dirname(currentPath), path))
  if (resolved.startsWith('../') || resolved === '..' || !files?.has(resolved)) {
    throw new GameRuntimeValidationError('Game resource path is missing or unsafe')
  }
}

function validateInlineCode (html: string) {
  const forbiddenPatterns = [
    /\bfetch\s*\(/i,
    /\bXMLHttpRequest\b/i,
    /\bWebSocket\b/i,
    /navigator\.sendBeacon\s*\(/i,
    /\bwindow\.(?:open|top|parent)\b/i,
    /\b(?:window\.)?(?:top|parent)\.location\b/i
  ]

  if (forbiddenPatterns.some(pattern => pattern.test(html))) throw new GameRuntimeValidationError('Network and top-level navigation APIs are not supported')
}

function cryptoRandomDirectoryName () {
  return randomUUID()
}

function isPathInside (rootPath: string, childPath: string) {
  const relativePath = relative(rootPath, childPath)
  return relativePath !== '' && !relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !relativePath.includes(`${sep}..${sep}`)
}
