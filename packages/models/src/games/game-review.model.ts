import type { GameCommentAccount } from './game-comment.model.js'

// 游戏评价 — 对应 GET /api/v1/games/:uuid/reviews
// 字段来源：server formatReviews()（community.ts:734-744）
export interface GameReview {
  id: number
  score: number
  text: string
  createdAt: string
  updatedAt: string
  isAuthor: boolean
  account: GameCommentAccount | null
}

// 评价列表响应
export interface GameReviewList {
  total: number
  data: GameReview[]
}

// 评价 upsert 结果
export interface GameReviewResult {
  review: GameReview
}
