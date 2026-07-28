import type { Game } from './game.model.js'

// 专题合集摘要
export interface GameCollection {
  id: number
  slug: string
  title: string
  description: string
  coverPath: string | null
  itemCount: number
  createdAt: string
  updatedAt: string
}

// 专题合集详情（含游戏列表）
export interface GameCollectionDetail extends GameCollection {
  games: Game[]
}

// 合集列表响应
export interface GameCollectionList {
  total: number
  data: GameCollection[]
}
