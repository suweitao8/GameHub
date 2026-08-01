import type { GameAuthorSummary } from './game.model.js'
import type { GameRatingType } from './game.type.js'

// 游戏社区状态 — 对应 GET /api/v1/games/:uuid/community
// 字段来源：server getCommunity()（community.ts:88-129）
export interface GameCommunity {
  isOwner: boolean
  likes: number
  reviews: number
  averageReviewScore: number
  chatMessages: number
  rating: GameRatingType | null
  favorite: boolean
  following: boolean
  coins: number
  favorites: number
  shares: number
  coinBalance: number
  coinsGiven: number
  author: GameAuthorSummary | null
}

// 相关推荐游戏摘要
export interface GameRelatedGame {
  uuid: string
  title: string
  category: string
  tags: string[]
  coverPath: string | null
  coverFallback: string | null
  playCount: number
  comments: number
  favorites: number
  publishedAt: string | null
  author: GameAuthorSummary | null
}

// 一键三连结果
export interface GameTripleResult {
  liked: boolean
  coined: boolean
  favorited: boolean
}

// 投币结果
export interface GameCoinResult {
  coins: number
  coinBalance: number
  coinsGiven: number
}

// 收藏/关注 切换结果
export interface GameBooleanResult {
  [key: string]: boolean
}
