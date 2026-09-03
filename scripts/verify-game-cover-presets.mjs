#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const assetsDirectory = join(root, 'client', 'src', 'assets', 'images', 'game-cover-presets')
const categories = [
  'arcade', 'adventure', 'shooter', 'puzzle', 'casual', 'rpg', 'strategy', 'simulation',
  'sandbox', 'racing', 'sports', 'card', 'music', 'horror', 'board', 'other'
]
const maxBytes = 120 * 1024
const failures = []
let totalBytes = 0

for (const category of categories) {
  const filePath = join(assetsDirectory, category + '.jpg')
  if (!existsSync(filePath)) {
    failures.push(category + '.jpg: 文件不存在')
    continue
  }

  const bytes = readFileSync(filePath)
  const fileSize = statSync(filePath).size
  totalBytes += fileSize

  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    failures.push(category + '.jpg: 不是 JPEG 文件')
  }
  if (fileSize > maxBytes) {
    failures.push(category + '.jpg: 文件大小 ' + fileSize + ' bytes 超过 ' + maxBytes + ' bytes')
  }

  try {
    const metadata = await sharp(filePath).metadata()
    if (metadata.width !== 512 || metadata.height !== 288) {
      failures.push(category + '.jpg: 尺寸为 ' + metadata.width + '×' + metadata.height + '，应为 512×288')
    }
    if (metadata.format !== 'jpeg') {
      failures.push(category + '.jpg: Sharp 识别格式为 ' + (metadata.format || 'unknown') + '，应为 jpeg')
    }
  } catch (error) {
    failures.push(category + '.jpg: 无法读取图片元数据 (' + (error.message || error) + ')')
  }
}

if (failures.length) {
  console.error('verify-game-cover-presets FAILED:')
  for (const failure of failures) console.error(' -', failure)
  process.exit(1)
}

console.log('verify-game-cover-presets OK: ' + categories.length + ' files, ' + (totalBytes / 1024).toFixed(1) + ' KB total')
