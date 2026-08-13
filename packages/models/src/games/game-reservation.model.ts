import type { Game } from './game.model.js'

// 预约创建结果 — 对应 POST /api/v1/games/:uuid/reserve
export interface GameReservation {
  id: number
  gameId: number
  createdAt: string
}

// 当前用户对某个游戏的预约状态 — 对应 GET /api/v1/games/:uuid/reserve
export interface GameReservationStatus {
  reserved: boolean
}

// 我的预约列表项
export interface GameReservationListItem {
  id: number
  notified: boolean
  createdAt: string
  game: Game
}

// 我的预约列表响应
export interface GameReservationList {
  total: number
  data: GameReservationListItem[]
}
