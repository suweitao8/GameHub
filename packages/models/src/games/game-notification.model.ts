import type { GameNotificationKind } from './game.type.js'

// 通知中的游戏摘要
export interface GameNotificationGame {
  uuid: string
  title: string
  coverPath: string | null
}

// 通知中的行为人摘要
export interface GameNotificationActor {
  id: number
  name: string
  displayName: string
}

// 游戏通知 — 对应 GET /api/v1/games/me/notifications
// 字段来源：server formatGameNotification()（index.ts:177-197）
export interface GameNotification {
  id: number
  kind: GameNotificationKind
  message: string
  read: boolean
  createdAt: string
  actor: GameNotificationActor | null
  game: GameNotificationGame | null
}

// 通知列表响应
export interface GameNotificationList {
  total: number
  unread: number
  data: GameNotification[]
}
