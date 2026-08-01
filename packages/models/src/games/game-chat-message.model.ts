import type { GameCommentAccount } from './game-comment.model.js'

// 游戏讨论群消息 — 与游戏评论完全独立
export interface GameChatMessage {
  id: number
  gameId: number
  text: string
  createdAt: string
  updatedAt: string
  account: GameCommentAccount | null
}

export interface GameChatMessageList {
  total: number
  data: GameChatMessage[]
}
