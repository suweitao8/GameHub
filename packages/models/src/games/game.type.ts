// 游戏状态：审核流转
export type GameStatus = 'pending' | 'published' | 'rejected' | 'unlisted' | 'blocked'

// 评分类型（点赞/取消）
export type GameRatingType = 'like' | 'none'

// 排序维度
export type GameSortMetric =
  | 'latest'
  | 'plays'
  | 'likes'
  | 'favorites'
  | 'coins'
  | 'comments'
  | 'updated'
  | 'hot'

// 排行榜维度
export type GameRankingKind =
  | 'hot'
  | 'newest'
  | 'updated'
  | 'topRated'
  | 'favorites'
  | 'coins'
  | 'comments'
  | 'likes'

// 评论排序
export type GameCommentSort = 'hot' | 'new' | 'old'

// 通知类型
export type GameNotificationKind =
  | 'comment'
  | 'reply'
  | 'like'
  | 'coin'
  | 'favorite'
  | 'follow'
  | 'moderation'
  | 'system'

// 硬币操作类型
export type GameCoinKind = 'daily_grant' | 'spend' | 'earn' | 'admin_adjust'

// 作者页排序
export type GameAuthorSort = 'latest' | 'plays' | 'favorites'

// 游戏设备类型
export type GameDevice = 'desktop' | 'mobile' | 'touch'
