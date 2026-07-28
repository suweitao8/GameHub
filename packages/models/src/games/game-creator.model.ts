import type { Game } from './game.model.js'

// 创作者概览 — 对应 GET /api/v1/games/me/overview
// 字段来源：server getCreatorOverview()（index.ts:302-333）
export interface GameCreatorOverview {
  gameCount: number
  gameLimit: number
  storageBytes: number
  storageLimitBytes: number
  plays: number
  likes: number
  coins: number
  coinBalance: number
  favorites: number
  followers: number
  games: Game[]
}

// 创作者分析 — 趋势数据点
export interface GamePlayTrendPoint {
  date: string
  plays: number
}

export interface GameInteractionBreakdown {
  likes: number
  coins: number
  favorites: number
  comments: number
  reviews: number
}

export interface GameCreatorGameRanking {
  gameId: number
  title: string
  plays: number
  likes: number
  coins: number
}

export interface GameFollowerTrendPoint {
  date: string
  followers: number
}

// 创作者分析响应 — 对应 GET /api/v1/games/me/analytics
// 字段来源：server getCreatorAnalytics()（index.ts:1139-1158）
export interface GameAnalytics {
  playTrend: GamePlayTrendPoint[]
  interactionBreakdown: GameInteractionBreakdown
  gameRanking: GameCreatorGameRanking[]
  followerTrend: GameFollowerTrendPoint[]
}
