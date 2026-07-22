import { Injectable } from '@angular/core'
import { Game } from './games.service'

export type BrowseRecord = {
  uuid: string
  title: string
  category: string
  tags: string[]
  authorId: number | null
  authorName: string | null
  viewedAt: string
}

const BROWSE_HISTORY_KEY = 'gamehub_browse_history'
const MAX_HISTORY = 100

function getStored (): BrowseRecord[] {
  try {
    const raw = localStorage.getItem(BROWSE_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BrowseRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setStored (items: BrowseRecord[]) {
  try {
    localStorage.setItem(BROWSE_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
  } catch {
    // localStorage full or unavailable
  }
}

@Injectable({ providedIn: 'root' })
export class GameRecommendService {
  recordView (game: Game) {
    const history = getStored()
    const existing = history.findIndex(item => item.uuid === game.uuid)
    if (existing !== -1) {
      history.splice(existing, 1)
    }
    history.unshift({
      uuid: game.uuid,
      title: game.title,
      category: game.category,
      tags: game.tags || [],
      authorId: game.author?.id ?? null,
      authorName: game.author?.displayName || game.author?.name || null,
      viewedAt: new Date().toISOString()
    })
    setStored(history)
  }

  getHistory (): BrowseRecord[] {
    return getStored()
  }

  getInterestWeights (): { categories: Record<string, number>; tags: Record<string, number>; authors: Record<string, number> } {
    const history = getStored()
    const categories: Record<string, number> = {}
    const tags: Record<string, number> = {}
    const authors: Record<string, number> = {}

    for (const item of history) {
      if (item.category) {
        categories[item.category] = (categories[item.category] || 0) + 1
      }
      for (const tag of item.tags) {
        tags[tag] = (tags[tag] || 0) + 1
      }
      if (item.authorId) {
        const authorKey = String(item.authorId)
        authors[authorKey] = (authors[authorKey] || 0) + 1
      }
    }

    return { categories, tags, authors }
  }

  scoreRelevance (game: Game): number {
    const { categories, tags, authors } = this.getInterestWeights()
    let score = 0

    if (game.category && categories[game.category]) {
      score += categories[game.category] * 2
    }

    for (const tag of game.tags || []) {
      if (tags[tag]) {
        score += tags[tag]
      }
    }

    if (game.author?.id && authors[String(game.author.id)]) {
      score += authors[String(game.author.id)] * 3
    }

    // Penalize already viewed games
    const history = getStored()
    if (history.some(item => item.uuid === game.uuid)) {
      score -= 10
    }

    return score
  }

  recommend (games: Game[], count = 6): Game[] {
    if (getStored().length === 0) return []

    const scored = games
      .map(game => ({ game, score: this.scoreRelevance(game) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, count).map(item => item.game)
  }

  clearHistory () {
    setStored([])
  }
}
