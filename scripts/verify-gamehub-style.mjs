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

function checkProductGradients (rel, rawSource) {
  const source = stripComments(rawSource)
  if (/(?:linear|radial|conic)-gradient\s*\(/i.test(source)) {
    failures.push(`${rel} uses a product-shell gradient; use a semantic surface or state token`)
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
const cardTemplate = read('client/src/app/+games/game-card.component.html')
const cardTypescript = read('client/src/app/+games/game-card.component.ts')
const featuredTemplate = read('client/src/app/+games/games-home/featured-carousel.component.html')
const featuredTypescript = read('client/src/app/+games/games-home/featured-carousel.component.ts')
const featuredStyles = read('client/src/app/+games/games-home/featured-carousel.component.scss')
const homeLayout = read('client/src/app/+games/games-home/_layout.scss')
const homeDiscovery = read('client/src/app/+games/games-home/_discovery-nav.scss')
const gameSectionTypescript = read('client/src/app/+games/games-home/game-section.component.ts')
const cardStyles = read('client/src/app/+games/game-card.component.scss')
const followerGrowthTypescript = read('client/src/app/+games/analytics/follower-growth-chart.component.ts')

// 1) Token and global-layer contracts.
assert(tokens.includes('--game-page-bg: #f6f7f8'), 'GameHub canvas must use the content-platform light page background')
assert(tokens.includes('--game-surface: #ffffff'), 'GameHub cards and panels must use a white surface')
assert(tokens.includes('--game-surface-alt: #f1f2f3'), 'GameHub secondary surfaces must use the content-platform muted surface')
assert(tokens.includes('--game-text-primary: #18191c'), 'GameHub primary text must use the content-platform ink token')
assert(tokens.includes('--game-text-secondary: #61666d'), 'GameHub secondary text must use the content-platform muted ink token')
assert(tokens.includes('--game-border: #e3e5e7'), 'GameHub borders must use the content-platform border token')
assert(tokens.includes('--game-brand: #007ea7'), 'GameHub primary actions must use the restrained brand blue')
assert(tokens.includes('--game-brand-contrast: #ffffff'), 'GameHub primary controls must define a readable light foreground')
assert(tokens.includes('--game-brand-vivid: #00aeec'), 'GameHub vivid brand accent must be reserved for selected media states')
assert(tokens.includes('--game-accent: #007ea7'), 'GameHub accent must use the restrained content-platform blue')
assert(tokens.includes('--game-brand-glow: transparent'), 'GameHub light skin must not use a colored brand glow')
assert(tokens.includes('--game-accent-glow: transparent'), 'GameHub light skin must not use a colored accent glow')
assert(tokens.includes('--game-focus-ring: 0 0 0 3px rgb(0 126 167 / 24%)'), 'GameHub controls must define the shared blue focus ring')
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
assert(!tokens.includes('cover-tone-'), 'GameHub tokens must not ship the multicolor cover-tone palette')
assert(!cardTemplate.includes('coverToneClass'), 'Game cards must not attach a multicolor cover-tone class')
assert(!cardTypescript.includes('coverToneClass'), 'Game cards must not import the multicolor cover-tone helper')
assert(!featuredTemplate.includes('coverToneClass'), 'Featured carousel must not attach a multicolor cover-tone class')
assert(!featuredTypescript.includes('FEATURED_PLACEHOLDER_AVG_RGB'), 'Featured carousel must not depend on sampled placeholder colors')
assert(!featuredTypescript.includes('averageRgb'), 'Featured carousel must not calculate image-average footer colors')
assert(!featuredStyles.includes('linear-gradient'), 'Featured carousel must not use decorative color gradients')
assert(!featuredStyles.includes('cover-tone'), 'Featured carousel must not use multicolor cover-tone variables')
assert(!featuredStyles.includes('sampled-color fade'), 'Featured carousel must not use sampled-color footer fades')
assert(
  !followerGrowthTypescript.includes('<linearGradient') &&
    !followerGrowthTypescript.includes('url(#followerGradient)') &&
    followerGrowthTypescript.includes('fill="var(--game-brand-soft)"'),
  'Follower growth chart must use a flat semantic area instead of an inline gradient'
)
assert(
  /\.game-submit-button\s*\{[\s\S]{0,500}background:\s*var\(--game-brand\);/.test(header) &&
    !/\.game-submit-button\s*\{[\s\S]{0,500}background:\s*var\(--game-accent\);/.test(header),
  'GameHub submit CTA must use the primary teal instead of the accent color'
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
  /\.game-navigation-search\s*\{[\s\S]{0,500}background:\s*transparent;[\s\S]{0,500}border:\s*0;/.test(navigation) &&
    /\.game-navigation-search input\s*\{[\s\S]{0,500}border:\s*1px solid var\(--game-border\);[\s\S]{0,500}background:\s*var\(--game-surface\);/.test(navigation) &&
    /\.game-navigation-search input:focus-visible\s*\{[\s\S]{0,300}border-color:\s*var\(--game-brand\)(?:\s*!important)?;[\s\S]{0,300}box-shadow:\s*var\(--game-focus-ring\)(?:\s*!important)?;/.test(navigation) &&
    !navigation.includes('.game-navigation-search:focus-within'),
  'GameHub search must keep one input border and one input-owned focus ring'
)
assert(
  homeDiscovery.includes('background: transparent;') &&
    homeDiscovery.includes('border-bottom: 2px solid transparent;') &&
    homeDiscovery.includes('min-height: 44px;'),
  'GameHub discovery navigation must use a text-tab rhythm with a 44px touch target'
)
assert(
  homeDiscovery.includes('border-bottom: 2px solid var(--game-brand);') &&
    !homeDiscovery.includes('background: var(--game-brand-soft);'),
  'GameHub discovery navigation must express the active state with an underline instead of a row of pills'
)
assert(
  navigation.includes('background: var(--game-search-surface);'),
  'GameHub search input must consume the shared content-platform field surface'
)
assert(
  cardTemplate.includes('game-card-category') &&
    cardTemplate.includes('game-card-meta-line') &&
    !cardTemplate.includes('class="game-card-meta"'),
  'Game cards must place category and stats in the content body instead of a dark cover strip'
)
assert(
  cardStyles.includes('background: transparent;') &&
    cardStyles.includes('border: 0;') &&
    cardStyles.includes('box-shadow: none;') &&
    cardStyles.includes('border-radius: 0;'),
  'Standard game cards must be image-led content units without the old white-box chrome'
)
assert(
  featuredStyles.includes('grid-template-columns: repeat(12, minmax(0, 1fr));') &&
    /\.featured-carousel\s*\{[\s\S]{0,900}grid-column:\s*span 6;/.test(featuredStyles) &&
    /\.featured-side-grid\s*\{[\s\S]{0,900}grid-column:\s*span 6;/.test(featuredStyles),
  'Featured discovery must use a 12-column lead-and-side content composition'
)
assert(
  /\.featured-side-grid\s*\{[\s\S]{0,900}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/.test(featuredStyles),
  'Featured side cards must stay readable in a two-column content rail'
)
assert(
  cardTemplate.includes('cover-poster-kicker') && cardTemplate.includes('cover-poster-index'),
  'Game cards must expose semantic poster fallback labels'
)
assert(
  featuredTemplate.includes('featured-cover-copy'),
  'Featured carousel must expose an in-cover title hierarchy'
)
assert(
  homeLayout.includes('grid-template-columns: repeat(5, minmax(0, 1fr));') &&
    homeLayout.includes('max-width: 1280px'),
  'Game discovery grids must stay dense while using the shared 1280px content rail'
)
assert(
  gameSectionTypescript.includes('background: transparent;') &&
    gameSectionTypescript.includes('border: 0;') &&
    gameSectionTypescript.includes('border-bottom: 2px solid transparent;'),
  'Inline game sections must share the image-led card and text-tab vocabulary'
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
  const source = read(rel)
  checkVisualValues(rel, source)
  checkProductGradients(rel, source)
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
    checkProductGradients(rel, match[1])
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
