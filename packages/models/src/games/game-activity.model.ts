// 社区动态行为人摘要
export interface GameActivityActor {
  id: number
  name: string
  displayName: string | null
}

// 社区动态游戏摘要
export interface GameActivityGame {
  uuid: string
  title: string
  coverPath: string | null
}

// 社区动态 — 对应 GET /api/v1/games/feed 和 /feed/public
export interface GameActivity {
  id: number
  kind: string
  message: string
  createdAt: string
  actor: GameActivityActor | null
  game: GameActivityGame | null
}

// 动态列表响应
export interface GameActivityList {
  total: number
  data: GameActivity[]
}
