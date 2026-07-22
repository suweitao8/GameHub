import { Injectable } from '@angular/core'
import { Game } from './games.service'

export type WatchLaterItem = {
  uuid: string
  title: string
  coverPath: string | null
  authorName: string | null
  addedAt: string
}

const WATCH_LATER_KEY = 'gamehub_watch_later'
const MAX_ITEMS = 200

function isValidWatchLaterItem (item: unknown): item is WatchLaterItem {
  if (!item || typeof item !== 'object') return false
  const candidate = item as Record<string, unknown>
  return (
    typeof candidate.uuid === 'string' &&
    typeof candidate.title === 'string' &&
    (candidate.coverPath === null || typeof candidate.coverPath === 'string') &&
    (candidate.authorName === null || typeof candidate.authorName === 'string') &&
    typeof candidate.addedAt === 'string'
  )
}

function getStored (): WatchLaterItem[] {
  try {
    const raw = localStorage.getItem(WATCH_LATER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidWatchLaterItem)
  } catch {
    return []
  }
}

function setStored (items: WatchLaterItem[]) {
  try {
    localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // localStorage full or unavailable
  }
}

@Injectable({ providedIn: 'root' })
export class WatchLaterService {
  getItems (): WatchLaterItem[] {
    return getStored()
  }

  add (game: Pick<Game, 'uuid' | 'title' | 'coverPath'> & { author?: { displayName?: string; name?: string } | null }) {
    const items = getStored()
    const existing = items.findIndex(item => item.uuid === game.uuid)
    if (existing !== -1) {
      // Move to top (most recent)
      items.splice(existing, 1)
    }
    const authorName = game.author?.displayName || game.author?.name || null
    items.unshift({
      uuid: game.uuid,
      title: game.title,
      coverPath: game.coverPath || null,
      authorName,
      addedAt: new Date().toISOString()
    })
    setStored(items)
  }

  remove (uuid: string) {
    const items = getStored().filter(item => item.uuid !== uuid)
    setStored(items)
  }

  has (uuid: string): boolean {
    return getStored().some(item => item.uuid === uuid)
  }

  toggle (game: Parameters<typeof this.add>[0]) {
    if (this.has(game.uuid)) {
      this.remove(game.uuid)
      return false
    }
    this.add(game)
    return true
  }

  clear () {
    setStored([])
  }

  getCount (): number {
    return getStored().length
  }
}
