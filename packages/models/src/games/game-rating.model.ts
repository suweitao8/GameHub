// 评分分布桶
export interface GameRatingBucket {
  star: number
  count: number
  percent: number
}

// 评分分布响应 — 对应 GET /api/v1/games/:uuid/rating-distribution
export interface GameRatingDistribution {
  total: number
  distribution: GameRatingBucket[]
}
