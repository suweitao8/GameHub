#!/usr/bin/env node
/**
 * Static contract checks for the active GameHub SPA visual system.
 *
 * The check intentionally excludes PeerTube standalone artifacts and the
 * explicitly dark game-stage/share surfaces. It should fail when a standard
 * GameHub surface introduces a raw visual value instead of a GameHub token.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function read (rel) {
  const absolutePath = join(root, rel)
  if (!existsSync(absolutePath)) {
    failures.push(`missing file: ${rel}`)
    return ''
  }

  return readFileSync(absolutePath, 'utf8')
}

function assert (condition, message) {
  if (!condition) failures.push(message)
}

function collectFiles (dir, suffix) {
  if (!existsSync(dir)) return []

  const result = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...collectFiles(absolutePath, suffix))
    else if (entry.isFile() && entry.name.endsWith(suffix)) result.push(absolutePath)
  }

  return result
}

function stripComments (source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, value => value.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '')
}

function isStandardStyleFile (rel) {
  return (
    rel.startsWith('client/src/app/+games/') ||
    rel.startsWith('client/src/app/+login/') ||
    rel.startsWith('client/src/app/+reset-password/') ||
    rel.startsWith('client/src/app/+signup/shared/') ||
    rel.startsWith('client/src/app/header/') ||
    rel === 'client/src/app/game-about.component.scss' ||
    rel === 'client/src/app/game-account-home.component.scss' ||
    rel === 'client/src/app/game-account-settings.component.scss' ||
    rel === 'client/src/app/game-not-found.component.scss' ||
    rel === 'client/src/app/shared/shared-forms/input-text.component.scss'
  )
}

function checkVisualValues (rel, rawSource, lineOffset = 0) {
  const source = stripComments(rawSource)
  const colorPattern = /(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/gi
  for (const match of source.matchAll(colorPattern)) {
    failures.push(`${rel}:${lineOffset + lineNumberAt(source, match.index)} uses a raw color; use a semantic --game-* token`)
  }

  const visualPropertyPattern = /(border-radius|box-shadow)\s*:\s*([^;{}]+)/gi
  for (const match of source.matchAll(visualPropertyPattern)) {
    const property = match[1].toLowerCase()
    const value = match[2].trim().replace(/\s+/g, ' ')
    const lineNumber = lineOffset + lineNumberAt(source, match.index)

    if (property === 'border-radius' && !value.startsWith('var(--game-') && ![ '0', '50%', '100%' ].includes(value)) {
      failures.push(`${rel}:${lineNumber} uses a raw radius; use a semantic --game-* token`)
    }

    if (property === 'box-shadow' && !value.startsWith('var(--game-') && !value.startsWith('none')) {
      failures.push(`${rel}:${lineNumber} uses a raw shadow; use a semantic --game-* token`)
    }
  }
}

function lineNumberAt (source, index) {
  return source.slice(0, index).split('\n').length
}

const tokenPath = 'client/src/app/+games/game-community.tokens.scss'
const intentionallySpecialized = new Set([
  'client/src/app/+games/game-play/_runtime-frame.scss',
  'client/src/app/+games/game-screenshots.component.scss',
  'client/src/app/+games/game-share-dialog.component.scss'
])

const tokens = read(tokenPath)
const ui = read('client/src/sass/include/_gamehub-ui.scss')
const application = read('client/src/sass/application.scss')
const header = read('client/src/app/header/header.component.scss')
const navigation = read('client/src/app/header/game-navigation.component.scss')

// 1) Token and global-layer contracts.
assert(tokens.includes('--game-page-bg: #f1fbfe'), 'GameHub canvas must use the ice-blue brand background')
assert(tokens.includes('--game-surface-alt: #e7f6fb'), 'GameHub secondary surfaces must use the ice-blue surface token')
assert(tokens.includes('--game-text-primary: #0c2d3a'), 'GameHub primary text must use the blue-black ink token')
assert(tokens.includes('--game-border: #d0e6ed'), 'GameHub borders must use the blue-tinted border token')
assert(tokens.includes('--game-brand: #00aeec'), 'GameHub brand must match the Logo blue')
assert(tokens.includes('--game-brand-contrast: #06222d'), 'Logo-blue controls must define their dark contrast color')
assert(tokens.includes('--game-control-height: 44px'), 'GameHub tokens must define the standard control height')
assert(tokens.includes('--game-control-height-sm: 38px'), 'GameHub tokens must define the compact control height')
assert(tokens.includes('--game-radius-control:'), 'GameHub tokens must define the control radius')
assert(tokens.includes('--game-focus-ring:'), 'GameHub tokens must define the shared focus ring')
assert(tokens.includes('--game-space-page:'), 'GameHub tokens must define the page gutter')
assert(tokens.includes('--game-space-grid:'), 'GameHub tokens must define the shared grid spacing')
assert(tokens.includes('--game-info:'), 'GameHub tokens must define the info semantic color')
assert(application.includes('@use "./include/gamehub-ui"'), 'application.scss must load the GameHub UI layer')
assert(ui.includes('.game-ui-surface'), 'GameHub UI layer must expose a surface contract')
assert(ui.includes('.game-ui-control'), 'GameHub UI layer must expose a control contract')
assert(ui.includes('.game-ui-button-primary'), 'GameHub UI layer must expose a primary button contract')
assert(ui.includes('.game-ui-button-secondary'), 'GameHub UI layer must expose a secondary button contract')
assert(ui.includes('.game-ui-button-danger'), 'GameHub UI layer must expose a danger button contract')
assert(ui.includes('.game-ui-status'), 'GameHub UI layer must expose a state contract')
assert(
  /\.game-submit-button\s*\{[\s\S]{0,500}background:\s*var\(--game-brand\);/.test(header) &&
    !/\.game-submit-button\s*\{[\s\S]{0,500}background:\s*var\(--game-accent\);/.test(header),
  'GameHub submit CTA must use Logo blue instead of the pink accent'
)
assert(
  /\.game-submit-button\s*\{[\s\S]{0,500}height:\s*44px;[\s\S]{0,500}min-height:\s*44px;/.test(header),
  'GameHub submit CTA must keep the shared 44px touch target'
)
assert(
  /\.game-search-history button\s*\{[\s\S]{0,400}min-height:\s*var\(--game-control-height\);/.test(navigation) &&
    /\.game-search-hot-list button\s*\{[\s\S]{0,500}min-height:\s*var\(--game-control-height\);/.test(navigation),
  'GameHub search history and hot-search actions must keep the shared touch target height'
)
assert(
  /\.game-search-panel-heading button\s*\{[\s\S]{0,500}color:\s*var\(--game-text-hint\);[\s\S]{0,500}min-height:\s*var\(--game-control-height\);/.test(navigation) &&
    /&:hover,[\s\S]{0,160}&:focus-visible\s*\{[\s\S]{0,120}color:\s*var\(--game-brand-deep\);/.test(navigation),
  'GameHub search panel utility actions must use readable brand text and a visible focus ring'
)
assert(
  navigation.includes('.game-navigation-search:focus-within') &&
    navigation.includes('border-color: var(--game-brand-border)') &&
    navigation.includes('box-shadow: var(--game-focus-ring)'),
  'GameHub search must keep a single shared brand focus ring'
)
assert(ui.includes('body:has(.peertube-container.game-experience)'), 'GameHub UI layer must scope body-mounted overlays to the active app shell')
checkVisualValues('client/src/sass/include/_gamehub-ui.scss', ui)

// 2) Standard active-page styles must consume the shared visual vocabulary.
const allStyleFiles = collectFiles(join(root, 'client/src/app'), '.scss')
const standardStyleFiles = allStyleFiles
  .map(file => relative(root, file).replaceAll('\\', '/'))
  .filter(isStandardStyleFile)
  .filter(file => file !== tokenPath && !intentionallySpecialized.has(file))

assert(standardStyleFiles.length > 20, 'style contract must scan the active GameHub style surface')

for (const rel of standardStyleFiles) {
  checkVisualValues(rel, read(rel))
}

// Standalone GameHub components also contain small inline style blocks. Keep
// those blocks on the same contract so a new component cannot reintroduce a
// one-off card or control style outside the SCSS inventory.
const embeddedStyleFiles = collectFiles(join(root, 'client/src/app/+games'), '.ts')
  .map(file => relative(root, file).replaceAll('\\', '/'))

for (const rel of embeddedStyleFiles) {
  const source = read(rel)
  for (const match of source.matchAll(/styles\s*:\s*\[\s*`([\s\S]*?)`\s*\]/g)) {
    checkVisualValues(rel, match[1], lineNumberAt(source, match.index) - 1)
  }
}

const activeTemplateFiles = collectFiles(join(root, 'client/src/app/+games'), '.html')
for (const absolutePath of activeTemplateFiles) {
  const rel = relative(root, absolutePath).replaceAll('\\', '/')
  const source = read(rel)
  for (const match of source.matchAll(/style\s*=\s*"([^"]*)"/g)) {
    checkVisualValues(rel, match[1], lineNumberAt(source, match.index) - 1)
  }
}

if (failures.length) {
  console.error('verify-gamehub-style FAILED:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log('verify-gamehub-style OK')
console.log(` - scanned ${standardStyleFiles.length} active GameHub style files`)
console.log(' - token, surface, control, state and raw-value contracts')
