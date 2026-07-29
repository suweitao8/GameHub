/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { writeFileSync } from 'fs'
import { join } from 'path'

describe('Test games API', function () {
  let server: PeerTubeServer
  let userAccessToken: string
  let secondUserAccessToken: string
  let publishedGameUuid: string

  const sampleHtml = '<!DOCTYPE html><html><head><title>Test</title></head><body><canvas id="c"></canvas><script>console.log("test game")</script></body></html>'

  async function uploadGame (server: PeerTubeServer, token: string, title: string) {
    const filePath = join(server.storePath, 'test-game.html')
    writeFileSync(filePath, sampleHtml)

    const body = new FormData()
    body.append('gamefile', new Blob([ sampleHtml ]), 'test-game.html')
    body.append('title', title)
    body.append('description', 'A test game')
    body.append('instructions', 'Click to play')
    body.append('category', 'arcade')
    body.append('tags', '["test","arcade"]')

    const res = await fetch(`${server.url}/api/v1/games`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body
    })

    return res
  }

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    // Create test users
    await server.users.create({ username: 'gamedev', password: 'password' })
    userAccessToken = await server.login.getAccessToken({ username: 'gamedev', password: 'password' })

    await server.users.create({ username: 'player1', password: 'password' })
    secondUserAccessToken = await server.login.getAccessToken({ username: 'player1', password: 'password' })
  })

  after(async function () {
    this.timeout(60000)
    await cleanupTests([ server ])
  })

  // ---------------------------------------------------------------------------
  // Game CRUD
  // ---------------------------------------------------------------------------

  describe('Game CRUD', function () {
    it('should reject upload without authentication', async function () {
      const res = await fetch(`${server.url}/api/v1/games`, {
        method: 'POST',
        body: new FormData()
      })

      expect(res.status).to.equal(HttpStatusCode.UNAUTHORIZED_401)
    })

    it('should upload a game', async function () {
      const res = await uploadGame(server, userAccessToken, 'Test Game')

      expect(res.status).to.equal(HttpStatusCode.CREATED_201)
      const game = await res.json()
      expect(game.uuid).to.be.a('string')
      expect(game.title).to.equal('Test Game')
      expect(game.status).to.be.oneOf([ 'pending', 'published' ])
      expect(game.category).to.equal('arcade')
      expect(game.tags).to.deep.include('test')
      expect(game.tags).to.deep.include('arcade')
      expect(game.fileSizeBytes).to.be.greaterThan(0)

      if (game.status === 'published') {
        publishedGameUuid = game.uuid
      }
    })

    it('should list games', async function () {
      const res = await fetch(`${server.url}/api/v1/games`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.total).to.be.a('number')
      expect(result.data).to.be.an('array')
    })

    it('should get a game by UUID', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const game = await res.json()
      expect(game.uuid).to.equal(publishedGameUuid)
      expect(game.title).to.equal('Test Game')
      expect(game.runtimeUrl).to.be.a('string')
    })

    it('should return 404 for unknown UUID', async function () {
      const res = await fetch(`${server.url}/api/v1/games/nonexistent-uuid-12345`)
      expect(res.status).to.equal(HttpStatusCode.NOT_FOUND_404)
    })

    it('should record a play', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/play`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAccessToken}` }
      })

      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.runtimeUrl).to.be.a('string')
    })

    it('should update a game', async function () {
      if (!publishedGameUuid) this.skip()

      const body = new FormData()
      body.append('title', 'Updated Title')
      body.append('description', 'Updated description')
      body.append('instructions', 'Updated instructions')
      body.append('category', 'puzzle')
      body.append('tags', '["updated"]')

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userAccessToken}` },
        body
      })

      // Update may reset to pending for non-moderators
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const game = await res.json()
      expect(game.title).to.equal('Updated Title')
    })
  })

  // ---------------------------------------------------------------------------
  // Community Interactions (only test on published games)
  // ---------------------------------------------------------------------------

  describe('Community interactions', function () {
    it('should get community state', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/community`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const community = await res.json()
      expect(community.likes).to.be.a('number')
      expect(community.favorite).to.be.a('boolean')
      expect(community.following).to.be.a('boolean')
      expect(community.coinBalance).to.be.a('number')
    })

    it('should like a game', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/rate`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${secondUserAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 'like' })
      })

      expect(res.status).to.equal(HttpStatusCode.OK_200)
    })

    it('should favorite a game', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/favorite`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${secondUserAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ favorite: true })
      })

      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.favorite).to.equal(true)
    })

    it('should list comments', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/comments`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.total).to.be.a('number')
      expect(result.data).to.be.an('array')
    })

    it('should add a comment', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secondUserAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: 'Great game!' })
      })

      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.comment).to.be.an('object')
      expect(result.comment.text).to.equal('Great game!')
    })

    it('should get rating distribution', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/rating-distribution`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.total).to.be.a('number')
      expect(result.distribution).to.be.an('array')
    })
  })

  // ---------------------------------------------------------------------------
  // Rankings & Discovery
  // ---------------------------------------------------------------------------

  describe('Rankings & discovery', function () {
    it('should get rankings', async function () {
      const res = await fetch(`${server.url}/api/v1/games/rankings?kind=hot&count=10`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.kind).to.equal('hot')
      expect(result.data).to.be.an('array')
    })

    it('should list tags', async function () {
      const res = await fetch(`${server.url}/api/v1/games/tags`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const tags = await res.json() as any[]
      expect(tags).to.be.an('array')
    })

    it('should list categories', async function () {
      const res = await fetch(`${server.url}/api/v1/games/categories`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const categories = await res.json() as any[]
      expect(categories).to.be.an('array')
    })

    it('should list featured games', async function () {
      const res = await fetch(`${server.url}/api/v1/games/featured`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.data).to.be.an('array')
    })
  })
})
