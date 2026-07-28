import type { Game } from './game.model.js'
import type { GameAuthorSort } from './game.type.js'

// 作者页响应 — 对应 GET /api/v1/games/author/:accountId
// 字段来源：server getAuthor()（index.ts:254-300）
export interface GameAuthor {
  account: {
    id: number
    name: string
    displayName: string
    description: string
    handle: string
    followers: number
  }
  stats: {
    games: number
    plays: number
    likes: number
    favorites: number
    coins: number
  }
  following: boolean
  data: Game[]
}

// 已关注作者摘要（me/following 列表项）
export interface GameFollowedAuthor {
  id: number
  name: string
  displayName: string
  description: string
  handle: string
  followers: number
  games: number
}

export type { GameAuthorSort }
