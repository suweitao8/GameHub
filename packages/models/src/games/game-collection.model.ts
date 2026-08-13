import type { Game } from './game.model.js'

// 专题合集摘要
export interface GameCollection {
  id: number
  slug: string
  title: string
  description: string | null
  coverPath: string | null
  gameCount: number
  createdAt: string
  updatedAt: string
}

// 专题合集详情（含游戏列表）
export interface GameCollectionDetail extends GameCollection {
  total: number
  data: Game[]
}

// 合集列表响应
export interface GameCollectionList {
  total: number
  data: GameCollection[]
}
