/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  mergeWithPersonalization,
  RECENCY_HALF_LIFE_DAYS,
  scoreGameForRecommendation
} from '../../../../../server/core/lib/games/game-recommendation-score.js'

const NOW = new Date('2026-08-11T00:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

describe('Game recommendation scoring', function () {
  describe('scoreGameForRecommendation', function () {
    it('gives a positive baseline score to a brand-new zero-interaction game (recency boost)', function () {
      const score = scoreGameForRecommendation({
        playCount: 0, likes: 0, dislikes: 0, favorites: 0, coins: 0,
        featured: false,
        publishedAt: NOW
      }, NOW)
      // 仅 recency 项有贡献：e^0 * 3.0 = 3.0
      expect(score).to.be.closeTo(3.0, 0.001)
    })

    it('rewards higher play count with a higher score', function () {
      const low = scoreGameForRecommendation({
        playCount: 5, likes: 0, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      const high = scoreGameForRecommendation({
        playCount: 5000, likes: 0, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      expect(high).to.be.greaterThan(low)
    })

    it('treats dislikes as a negative quality signal (net likes = likes - dislikes)', function () {
      const base = scoreGameForRecommendation({
        playCount: 100, likes: 10, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      const withDislikes = scoreGameForRecommendation({
        playCount: 100, likes: 10, dislikes: 8, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      // 净点赞从 10 降到 2，质量分项应下降
      expect(withDislikes).to.be.lessThan(base)
    })

    it('clamps negative net quality to zero (no negative quality contribution)', function () {
      const negative = scoreGameForRecommendation({
        playCount: 100, likes: 0, dislikes: 50, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      const zero = scoreGameForRecommendation({
        playCount: 100, likes: 0, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      // dislikes 多于 likes 时 qualitySignal=max(0, -50)=0，与 0/0 一致
      expect(negative).to.equal(zero)
    })

    it('boosts featured games', function () {
      const normal = scoreGameForRecommendation({
        playCount: 100, likes: 10, dislikes: 0, favorites: 5, coins: 2,
        featured: false, publishedAt: NOW
      }, NOW)
      const featured = scoreGameForRecommendation({
        playCount: 100, likes: 10, dislikes: 0, favorites: 5, coins: 2,
        featured: true, publishedAt: NOW
      }, NOW)
      expect(featured - normal).to.be.closeTo(3.0, 0.001)
    })

    it('applies time decay: newer games score higher than old games with equal stats', function () {
      const freshScore = scoreGameForRecommendation({
        playCount: 1000, likes: 50, dislikes: 0, favorites: 10, coins: 5,
        featured: false, publishedAt: daysAgo(1)
      }, NOW)
      const oldScore = scoreGameForRecommendation({
        playCount: 1000, likes: 50, dislikes: 0, favorites: 10, coins: 5,
        featured: false, publishedAt: daysAgo(365)
      }, NOW)
      expect(freshScore).to.be.greaterThan(oldScore)
    })

    it('a high-interaction old game can still beat a low-interaction new game', function () {
      const oldHit = scoreGameForRecommendation({
        playCount: 100000, likes: 5000, dislikes: 0, favorites: 2000, coins: 800,
        featured: true, publishedAt: daysAgo(365)
      }, NOW)
      const newFlop = scoreGameForRecommendation({
        playCount: 1, likes: 0, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      // 老爆款的高互动量应能压过新冷门游戏的纯新鲜度分
      expect(oldHit).to.be.greaterThan(newFlop)
    })

    it('decays to ~37% after one half-life period', function () {
      const freshRecency = scoreGameForRecommendation({
        playCount: 0, likes: 0, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: NOW
      }, NOW)
      const agedRecency = scoreGameForRecommendation({
        playCount: 0, likes: 0, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: daysAgo(RECENCY_HALF_LIFE_DAYS)
      }, NOW)
      // e^(-1) ≈ 0.3679，衰减后应为 3.0 * 0.3679 ≈ 1.103
      expect(agedRecency).to.be.closeTo(freshRecency * Math.exp(-1), 0.01)
    })

    it('handles null publishedAt as infinite age (no recency boost)', function () {
      const score = scoreGameForRecommendation({
        playCount: 100, likes: 5, dislikes: 0, favorites: 0, coins: 0,
        featured: false, publishedAt: null
      }, NOW)
      // 无新鲜度加成，只有 playCount + quality
      const expected = Math.log10(101) * 2.5 + Math.log10(6) * 1.5
      expect(score).to.be.closeTo(expected, 0.001)
    })
  })

  describe('mergeWithPersonalization', function () {
    const mkGame = (id: number) => ({ id })

    it('falls back to global list when CF results are empty (cold start)', function () {
      const global = [ mkGame(1), mkGame(2), mkGame(3) ]
      const result = mergeWithPersonalization(global, [])
      expect(result).to.deep.equal(global)
    })

    it('places CF results first, filling remaining slots with global (no duplicates)', function () {
      const global = [ mkGame(1), mkGame(2), mkGame(3), mkGame(4), mkGame(5) ]
      const cf = [ mkGame(10), mkGame(20) ]
      const result = mergeWithPersonalization(global, cf)

      // CF 有 2 条，ratio=0.6 → ceil(2*0.6)=2 条 CF 占据前部
      expect(result.slice(0, 2)).to.deep.equal(cf)
      // 剩余位置填 global，且不含重复
      expect(result).to.deep.equal([ mkGame(10), mkGame(20), mkGame(1), mkGame(2), mkGame(3), mkGame(4), mkGame(5) ])
      const ids = result.map(g => g.id)
      expect(new Set(ids).size).to.equal(ids.length)
    })

    it('respects the ratio parameter', function () {
      const global = Array.from({ length: 10 }, (_, i) => mkGame(i + 1))
      const cf = Array.from({ length: 10 }, (_, i) => mkGame(100 + i))
      // ratio=0.5 → ceil(10*0.5)=5 条 CF
      const result = mergeWithPersonalization(global, cf, 0.5)
      const cfCount = result.filter(g => g.id >= 100).length
      expect(cfCount).to.equal(5)
    })
  })
})
