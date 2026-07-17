import { GameStatus } from '@server/types/models/game/game.js'

const GAME_STATUSES: GameStatus[] = [ 'pending', 'published', 'rejected', 'unlisted', 'blocked' ]

export function isGameStatusValid (value: any): value is GameStatus {
  return GAME_STATUSES.includes(value)
}

export function isGameTitleValid (value: string) {
  return typeof value === 'string' && value.trim().length >= 1 && value.length <= 120
}

export function isGameDescriptionValid (value: string) {
  return typeof value === 'string' && value.length <= 5000
}

export function isGameCategoryValid (value: string) {
  return typeof value === 'string' && value.trim().length >= 1 && value.length <= 64
}

export function areGameTagsValid (value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 20 && value.every(tag => {
    return typeof tag === 'string' && tag.trim().length >= 1 && tag.length <= 32
  })
}
