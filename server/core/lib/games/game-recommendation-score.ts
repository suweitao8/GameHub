import type { MGame } from '@server/types/models/game/game.js'

/**
 * 多因子推荐打分模块
 *
 * 设计目标：
 * - 综合播放量、质量信号（净点赞）、收藏、投币、编辑精选、新鲜度
 * - 所有信号对数压缩，避免头部游戏垄断 feed
 * - 时间衰减让新内容有曝光机会，老内容逐渐老化但可被高互动量抵消
 * - 纯函数，便于单测；权重常量集中管理，便于后续调优
 */

/** 时间衰减半衰期（天）：30 天后新内容加成衰减到 ~37% */
export const RECENCY_HALF_LIFE_DAYS = 30

/** 各因子权重 —— 可按需调优，无需改动打分逻辑 */
export const SCORE_WEIGHTS = {
  playCount: 2.5,
  quality: 1.5,
  favorites: 1.0,
  coins: 1.0,
  featured: 3.0,
  recency: 3.0
} as const

/** 登录用户个性化推荐中，CF 结果占首页的比例 */
export const PERSONALIZED_RATIO = 0.6

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface GameScoreInput {
  playCount: number
  likes: number
  dislikes: number
  favorites: number
  coins: number
  featured: boolean
  publishedAt: Date | string | null
}

/**
 * 从 Sequelize model 提取打分所需字段。
 * 兼容 listPublished 的 literal() 虚拟列（gameLikes 等）与 StatsSummary 关联。
 */
export function extractScoreInput (game: MGame): GameScoreInput {
  const readStat = (alias: string, field: string): number => {
    const value = game.get?.(alias) ?? game.StatsSummary?.get?.(field) ?? game.StatsSummary?.[field]
    return Number(value) || 0
  }

  return {
    playCount: Number(game.playCount) || 0,
    likes: readStat('gameLikes', 'likes'),
    dislikes: readStat('gameDislikes', 'dislikes'),
    favorites: readStat('favoriteCount', 'favorites'),
    coins: readStat('coinCount', 'coins'),
    featured: Boolean(game.featured),
    publishedAt: game.publishedAt
  }
}

/**
 * 计算单个游戏的全局热度推荐分。
 *
 * 分数 = log10(播放量) × W_play
 *      + log10(max(净点赞,0)) × W_quality
 *      + log10(收藏) × W_favorite
 *      + log10(投币) × W_coin
 *      + (精选 ? W_featured : 0)
 *      + e^(-年龄/半衰期) × W_recency
 *
 * 所有信号经过 log10(x+1) 压缩，避免线性叠加时大数值淹没小信号。
 */
export function scoreGameForRecommendation (input: GameScoreInput, now: Date = new Date()): number {
  const { playCount, likes, dislikes, favorites, coins, featured, publishedAt } = input

  const log = (n: number) => Math.log10(n + 1)

  const qualitySignal = Math.max(0, likes - dislikes)

  const ageDays = computeAgeDays(publishedAt, now)

  return log(playCount) * SCORE_WEIGHTS.playCount
    + log(qualitySignal) * SCORE_WEIGHTS.quality
    + log(favorites) * SCORE_WEIGHTS.favorites
    + log(coins) * SCORE_WEIGHTS.coins
    + (featured ? SCORE_WEIGHTS.featured : 0)
    + Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS) * SCORE_WEIGHTS.recency
}

function computeAgeDays (publishedAt: Date | string | null, now: Date): number {
  if (!publishedAt) return Infinity
  const publishedTime = new Date(publishedAt).getTime()
  if (Number.isNaN(publishedTime)) return Infinity
  return Math.max(0, (now.getTime() - publishedTime) / MS_PER_DAY)
}

/**
 * 把全局打分结果与 CF 个性化结果按比例融合。
 *
 * - cfGames 非空时：CF 结果按其顺序占据前 PERSONALIZED_RATIO 比例，
 *   剩余位置用 globalScored 填充（排除已出现过的游戏）。
 * - cfGames 为空（冷启动）时：直接返回 globalScored，实现无缝回退。
 *
 * 两个输入都应是已排序的游戏数组。
 */
export function mergeWithPersonalization<T extends { id: number }> (
  globalScored: T[],
  cfGames: T[],
  ratio: number = PERSONALIZED_RATIO
): T[] {
  if (cfGames.length === 0) return globalScored

  const cfCount = Math.ceil(cfGames.length * ratio)
  const cfSlice = cfGames.slice(0, cfCount)

  const seenIds = new Set(cfSlice.map(g => g.id))
  const backfill = globalScored.filter(g => !seenIds.has(g.id))

  return [ ...cfSlice, ...backfill ]
}
