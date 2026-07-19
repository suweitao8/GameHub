import { GameStatus } from '@server/types/models/game/game.js'

const GAME_STATUSES: GameStatus[] = [ 'pending', 'published', 'rejected', 'unlisted', 'blocked' ]

export function isGameStatusValid (value: any): value is GameStatus {
  return GAME_STATUSES.includes(value)
}

const FORBIDDEN_TITLE_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:text\/html/i
]

export function isGameTitleValid (value: string) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > 120) return false
  return !FORBIDDEN_TITLE_PATTERNS.some(pattern => pattern.test(trimmed))
}

export function isGameDescriptionValid (value: string) {
  if (typeof value !== 'string') return false
  if (value.length > 5000) return false
  // Block potential XSS patterns in descriptions
  const xssPatterns = [/<script\b/i, /javascript:/i, /on\w+\s*=/i]
  return !xssPatterns.some(pattern => pattern.test(value))
}

export function isGameCategoryValid (value: string) {
  return typeof value === 'string' && value.trim().length >= 1 && value.length <= 64
}

export function areGameTagsValid (value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 20 && value.every(tag => {
    return typeof tag === 'string' && tag.trim().length >= 1 && tag.length <= 32
  })
}
