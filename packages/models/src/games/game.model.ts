import type { GameStatus } from './game.type.js'

// 游戏作者摘要（嵌在 Game / Community / Notification 等响应中）
export interface GameAuthorSummary {
  id: number
  name: string
  displayName: string
  handle: string
}

// 游戏对象 — 对应 GET /api/v1/games/:uuid 和列表项
// 字段来源：server formatGame()（index.ts:131-170）
export interface Game {
  uuid: string
  title: string
  description: string
  instructions: string
  category: string
  tags: string[]
  coverPath: string | null
  screenshots: string[]
  status: GameStatus
  featured: boolean
  featuredAt: string | null
  fileSizeBytes: number
  playCount: number
  comments: number
  likes: number
  favorites: number
  coins: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  runtimeUrl: string
  ownerAccountId: number
  author: GameAuthorSummary | undefined
}

// 游戏列表响应
export interface GameList {
  total: number
  data: Game[]
}

// 游戏列表查询参数
export interface GamesListParams {
  category?: string
  search?: string
  sort?: string
  start?: number
  count?: number
  publishedAfter?: string
  device?: string
  view?: string
}

// 上传元数据
export interface GameUploadMetadata {
  title: string
  description: string
  instructions: string
  category: string
  tags: string
}
