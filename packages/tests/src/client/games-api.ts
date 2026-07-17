import { expect } from 'chai'
import { buildGameRuntimeUrl, buildGamesListUrl } from '../../../../client/src/app/+games/games-api.js'

describe('Games client API contract', function () {
  it('builds encoded list and runtime URLs without string-concatenating ids', function () {
    expect(buildGamesListUrl('http://localhost:9000', { search: 'space game', category: 'arcade', count: 12 }))
      .to.equal('http://localhost:9000/api/v1/games?search=space+game&category=arcade&count=12')
    expect(buildGameRuntimeUrl('http://games.localhost:9000', 'game-uuid'))
      .to.equal('http://games.localhost:9000/api/v1/games/game-uuid/runtime')
  })

  it('serializes device and publication-date filters for community search', function () {
    expect(buildGamesListUrl('http://localhost:9000', {
      search: 'space', device: 'mobile', publishedAfter: '2026-01-01', sort: 'latest'
    })).to.equal('http://localhost:9000/api/v1/games?search=space&publishedAfter=2026-01-01&device=mobile&sort=latest')
  })

  it('serializes the following feed view', function () {
    expect(buildGamesListUrl('http://localhost:9000', { view: 'following', sort: 'latest', count: 8 }))
      .to.equal('http://localhost:9000/api/v1/games?view=following&count=8&sort=latest')
  })
})
