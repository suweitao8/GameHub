import type { GameCommentSort } from './game.type.js'

// 评论账户摘要
export interface GameCommentAccount {
  displayName: string
  name: string
}

// 游戏评论 — 对应 GET /api/v1/games/:uuid/comments
// 字段来源：server formatComments()（community.ts:746-775）+ toFormattedJSON（game-comment.ts:86-105）
export interface GameComment {
  id: number
  url: null
  text: string
  imageUrl: string | null
  threadId: number
  inReplyToCommentId: number | null
  gameId: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  heldForReview: boolean
  isDeleted: boolean
  totalRepliesFromVideoAuthor: number
  totalReplies: number
  likeCount: number
  isFeatured: boolean
  account: GameCommentAccount | null
  // formatComments 追加字段
  likes: number
  liked: boolean
  isAuthor: boolean
  canDelete: boolean
}

// 评论列表响应
export interface GameCommentList {
  total: number
  data: GameComment[]
}

// 评论点赞结果
export interface GameCommentLikeResult {
  liked: boolean
  likes: number
  isFeatured?: boolean
}

export type { GameCommentSort }
