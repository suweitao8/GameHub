import { expect } from 'chai'
import { GameStatus, canManageGame, getModerationStatus } from '../../../../../server/core/lib/games/game-policy.js'

describe('Game API policy', function () {
  const owner = { id: 10, role: 2, Account: { id: 20 } }
  const otherUser = { id: 11, role: 2, Account: { id: 21 } }
  const moderator = { id: 12, role: 1, Account: { id: 22 } }
  const game = { ownerAccountId: 20, status: 'pending' as GameStatus }

  it('allows only the owner or a moderator to manage a game', function () {
    expect(canManageGame(game, owner)).to.equal(true)
    expect(canManageGame(game, otherUser)).to.equal(false)
    expect(canManageGame(game, moderator)).to.equal(true)
  })

  it('accepts only explicit moderation transitions', function () {
    expect(getModerationStatus('approve', 'pending')).to.equal('published')
    expect(getModerationStatus('reject', 'pending')).to.equal('rejected')
    expect(getModerationStatus('unlist', 'published')).to.equal('unlisted')
    expect(getModerationStatus('block', 'published')).to.equal('blocked')
    expect(getModerationStatus('approve', 'blocked')).to.equal(null)
    expect(getModerationStatus('delete', 'published')).to.equal(null)
  })
})
