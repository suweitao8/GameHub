// 用户等级信息 — 对应 GET /api/v1/games/me/level
// 字段来源：server getUserLevelInfo()（game-exp.ts:50-66）+ calculateLevel()（game-user-level.ts:38）
export interface GameLevelInfoDetails {
  level: number
  title: string
  currentLevelExp: number
  nextLevelExp: number | null
  progress: number
}

export interface GameLevelInfo {
  exp: number
  levelInfo: GameLevelInfoDetails
  dailyLoginAvailable: boolean
}

// 每日签到结果 — 对应 POST /api/v1/games/me/level/daily-login
export interface GameDailyLoginResult {
  claimed: boolean
  exp: number
  totalExp: number
  levelInfo: GameLevelInfoDetails
}
