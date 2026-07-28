// 游戏活动 — 对应 GET /api/v1/games/events
export interface GameEvent {
  id: number
  slug: string
  title: string
  description: string
  bannerPath: string | null
  status: 'upcoming' | 'ongoing' | 'ended'
  startsAt: string
  endsAt: string
  createdAt: string
  updatedAt: string
}

// 活动列表响应
export interface GameEventList {
  total: number
  data: GameEvent[]
}

// 分享结果 — 对应 POST /api/v1/games/:uuid/share
export interface GameShareResult {
  url: string
  shortUrl: string
}

// 举报结果 — 对应 POST /api/v1/games/:uuid/report
export interface GameReportResult {
  id: number
  state: string
}
