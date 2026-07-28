import type { Game } from './game.model.js'

// 预约创建结果 — 对应 POST /api/v1/games/:uuid/reserve
export interface GameReservation {
  id: number
  gameId: number
  createdAt: string
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
