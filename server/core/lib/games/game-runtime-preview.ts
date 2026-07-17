import { randomUUID } from 'crypto'
import { join, resolve } from 'path'
import { rm } from 'fs/promises'
import { readStoredGameRuntimeFile, storeGameRuntimePackage } from './game-runtime.js'

const PREVIEW_DIRECTORY = '.previews'
const PREVIEW_TTL_MS = 10 * 60 * 1000

export async function createGameRuntimePreview (input: {
  root: string
  filename: string
  mimeType?: string
  content: Buffer
  maxFileSizeBytes: number
}) {
  const token = randomUUID()
  const root = getPreviewRoot(input.root)
  const stored = await storeGameRuntimePackage({ ...input, root, directoryName: token })
  const timer = setTimeout(() => {
    void rm(stored.absoluteDirectory, { recursive: true, force: true })
  }, PREVIEW_TTL_MS)
  timer.unref?.()

  return { token, stored }
}

export async function readGameRuntimePreviewFile (root: string, token: string, relativePath: string) {
  return readStoredGameRuntimeFile(getPreviewRoot(root), `${token}/${relativePath}`)
}

export async function removeGameRuntimePreview (root: string, token: string) {
  await rm(join(getPreviewRoot(root), token), { recursive: true, force: true })
}

export function getPreviewRuntimePath (token: string, relativePath = 'index.html') {
  return `${token}/${relativePath}`
}

function getPreviewRoot (root: string) {
  return resolve(root, PREVIEW_DIRECTORY)
}
