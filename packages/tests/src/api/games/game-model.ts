import { expect } from 'chai'
import { isGameStatusValid } from '../../../../../server/core/helpers/custom-validators/games.js'

describe('Game model contract', function () {
  it('accepts only the persisted moderation states', function () {
    expect(isGameStatusValid('pending')).to.equal(true)
    expect(isGameStatusValid('published')).to.equal(true)
    expect(isGameStatusValid('rejected')).to.equal(true)
    expect(isGameStatusValid('unlisted')).to.equal(true)
    expect(isGameStatusValid('blocked')).to.equal(true)
    expect(isGameStatusValid('draft')).to.equal(false)
    expect(isGameStatusValid('')).to.equal(false)
  })
})
