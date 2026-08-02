import type { Game } from './game.model.js'
import type { GameRankingKind } from './game.type.js'

// 排行榜项 = 排名 + 完整游戏字段 + 统计摘要
// 字段来源：server getRankings()（index.ts:870-886）
export interface GameRanking extends Game {
  rank: number
  stats: {
    plays: number
    likes: number
    favorites: number
    coins: number
    comments: number
  }
}

// 排行榜响应
export interface GameRankingList {
  kind: string
  total: number
  data: GameRanking[]
}

export type { GameRankingKind }
