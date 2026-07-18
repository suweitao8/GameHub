import { expect } from 'chai'
import {
  canDeleteGameComment,
  isGameCommentVisible,
  isSupportedGameRating,
  normalizeGameRating,
  updateCommentLikeCount
} from '../../../../../server/core/lib/games/game-community-policy.js'
import { getGameSortMetric } from '../../../../../server/core/lib/games/game-query.js'
import { isGameNotificationKind } from '../../../../../server/core/lib/games/game-notifications.js'

describe('Game community comment policy', function () {
  it('allows the comment author, game author, or moderator to delete a comment', function () {
    expect(canDeleteGameComment({ commentAccountId: 10, userAccountId: 10, gameOwnerAccountId: 20, canManageAny: false })).to.equal(true)
    expect(canDeleteGameComment({ commentAccountId: 10, userAccountId: 20, gameOwnerAccountId: 20, canManageAny: false })).to.equal(true)
    expect(canDeleteGameComment({ commentAccountId: 10, userAccountId: 30, gameOwnerAccountId: 20, canManageAny: true })).to.equal(true)
    expect(canDeleteGameComment({ commentAccountId: 10, userAccountId: 30, gameOwnerAccountId: 20, canManageAny: false })).to.equal(false)
  })

  it('changes a comment like count only when the liked state changes', function () {
    expect(updateCommentLikeCount({ liked: false, likes: 4, nextLiked: true })).to.deep.equal({ liked: true, likes: 5 })
    expect(updateCommentLikeCount({ liked: true, likes: 4, nextLiked: false })).to.deep.equal({ liked: false, likes: 3 })
    expect(updateCommentLikeCount({ liked: true, likes: 0, nextLiked: true })).to.deep.equal({ liked: true, likes: 0 })
  })

  it('maps community search sorts to stable game metrics', function () {
    expect(getGameSortMetric('likes')).to.equal('likes')
    expect(getGameSortMetric('coins')).to.equal('coins')
    expect(getGameSortMetric('favorites')).to.equal('favorites')
    expect(getGameSortMetric('popular')).to.equal('plays')
    expect(getGameSortMetric('latest')).to.equal('latest')
    expect(getGameSortMetric('unknown')).to.equal('recommended')
  })

  it('hides deleted comment tombstones from the public game community', function () {
    expect(isGameCommentVisible({ isDeleted: false })).to.equal(true)
    expect(isGameCommentVisible({ isDeleted: true })).to.equal(false)
  })

  it('accepts only supported GameHub notification categories', function () {
    expect(isGameNotificationKind('comment')).to.equal(true)
    expect(isGameNotificationKind('coin')).to.equal(true)
    expect(isGameNotificationKind('moderation')).to.equal(true)
    expect(isGameNotificationKind('video-view')).to.equal(false)
  })

  it('supports likes and clearing a like but never dislikes', function () {
    expect(isSupportedGameRating('like')).to.equal(true)
    expect(isSupportedGameRating('none')).to.equal(true)
    expect(isSupportedGameRating('dislike')).to.equal(false)
    expect(normalizeGameRating('like')).to.equal('like')
    expect(normalizeGameRating('dislike')).to.equal('none')
    expect(normalizeGameRating(null)).to.equal('none')
  })
})
