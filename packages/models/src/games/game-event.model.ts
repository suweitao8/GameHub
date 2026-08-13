export type GameEventType = 'activity' | 'competition'
export type GameEventStatus = 'upcoming' | 'ongoing' | 'ended' | 'cancelled'

// 游戏活动 — 对应 GET /api/v1/games/events 和 /:slug
export interface GameEvent {
  id: number
  slug: string
  title: string
  description: string | null
  type: GameEventType
  status: GameEventStatus
  coverPath: string | null
  startAt: string | null
  endAt: string | null
  rules: string | null
  prizes: string | null
  maxParticipants: number
  participantCount: number
  createdBy: {
    id: number
    name: string
    displayName: string
  } | null
  createdAt: string
}

// 活动列表响应
export interface GameEventList {
  total: number
  data: GameEvent[]
}

// 报名或退出后返回的可信活动人数
export interface GameEventJoinResult {
  joined: boolean
  participantCount: number
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
