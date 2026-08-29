/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { SQLCommand } from '@tests/shared/sql-command.js'

type GameCollectionResponse = {
  gameCount: number
  createdAt: string
  slug: string
}

type GameCollectionDetailResponse = {
  gameCount: number
  total: number
  data: { uuid: string }[]
}

type GameEventParticipationResponse = { joined: boolean }
type GameEventJoinResponse = { joined: boolean, participantCount: number }
type GameEventErrorResponse = { error: string }
type GameReservationStatusResponse = { reserved: boolean }
type GameEventParticipantsResponse = { total: number }
type GameEventResponse = {
  title: string
  description: string | null
  slug: string
  maxParticipants: number
  participantCount: number
  createdBy: { id: number }
}
type GameArticleResponse = {
  title: string
  summary: string
  content?: string
  slug: string
  category: string
  viewCount: number
  createdBy: { id: number }
}

describe('Test games API', function () {
  let server: PeerTubeServer
  let userAccessToken: string
  let secondUserAccessToken: string
  let publishedGameUuid: string
  let sqlCommand: SQLCommand
  let rootAccountId: number
  let gameOwnerAccountId: number

  const sampleHtml = '<!DOCTYPE html><html><head><title>Test</title></head><body><canvas id="c"></canvas><script>console.log("test game")</script></body></html>'
  const testRedisPort = Number(process.env.GAMEHUB_TEST_REDIS_PORT) || 6379

  async function uploadGame (server: PeerTubeServer, token: string, title: string) {
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

  async function uploadGameWithDefaults (
    server: PeerTubeServer,
    token: string,
    content = sampleHtml,
    filename = 'quick-game.html'
  ) {
    const body = new FormData()
    body.append('gamefile', new Blob([ content ]), filename)

    return fetch(`${server.url}/api/v1/games`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body
    })
  }

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1, {
      secrets: { peertube: '0123456789abcdef'.repeat(4) },
      redis: { port: testRedisPort }
    })
    await setAccessTokensToServers([ server ])
    sqlCommand = new SQLCommand(server)

    // Create test users
    await server.users.create({ username: 'gamedev', password: 'password' })
    userAccessToken = await server.login.getAccessToken({ username: 'gamedev', password: 'password' })

    await server.users.create({ username: 'player1', password: 'password' })
    secondUserAccessToken = await server.login.getAccessToken({ username: 'player1', password: 'password' })

    rootAccountId = (await server.users.getMyInfo()).account.id
    gameOwnerAccountId = (await server.users.getMyInfo({ token: userAccessToken })).account.id
  })

  after(async function () {
    this.timeout(60000)
    if (sqlCommand) await sqlCommand.cleanup()
    if (server) await cleanupTests([ server ])
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

    it('should upload a game with only an HTML file', async function () {
      const res = await uploadGameWithDefaults(server, userAccessToken)
      const game = await res.json()

      expect(res.status, JSON.stringify(game)).to.equal(HttpStatusCode.CREATED_201)
      expect(game.title).to.equal('Test')
      expect(game.description).to.equal('')
      expect(game.instructions).to.equal('')
      expect(game.category).to.equal('other')
      expect(game.tags).to.deep.equal([])
    })

    it('falls back to the filename when the HTML title is unsafe', async function () {
      const res = await uploadGameWithDefaults(
        server,
        userAccessToken,
        '<!DOCTYPE html><title>data:text/html,<script>alert(1)</script></title>',
        'fallback-game.html'
      )
      const game = await res.json()

      expect(res.status, JSON.stringify(game)).to.equal(HttpStatusCode.CREATED_201)
      expect(game.title).to.equal('fallback game')
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
      expect(game.comments).to.be.a('number')
    })

    it('should return 404 for unknown UUID', async function () {
      const res = await fetch(`${server.url}/api/v1/games/00000000-0000-4000-8000-000000000000`)
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
      expect(result.commentCount).to.be.a('number')
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

    it('should not expose star rating distribution', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/rating-distribution`)
      expect(res.status).to.equal(HttpStatusCode.NOT_FOUND_404)
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

    it('should list game collections', async function () {
      const res = await fetch(`${server.url}/api/v1/games/collections`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.data).to.be.an('array')
    })

    it('should expose only published games in collection counts and details', async function () {
      const slug = `collection-${Date.now()}`
      const publishedUuid = `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`
      const hiddenUuid = `00000000-0000-4000-8001-${String(Date.now() + 1).slice(-12).padStart(12, '0')}`

      await sqlCommand.updateQuery(`
        INSERT INTO "game" (
          "uuid", "ownerAccountId", "title", "description", "instructions", "category", "tags", "coverPath",
          "screenshotPaths", "runtimePath", "runtimeSha256", "fileSizeBytes", "status", "playCount", "publishedAt", "createdAt", "updatedAt"
        ) VALUES
          (:publishedUuid, :ownerAccountId, 'Collection published game', '', '', 'arcade', ARRAY[]::TEXT[], NULL,
           ARRAY[]::TEXT[], 'test/published.html', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1, 'published', 0, NOW(), NOW(), NOW()),
          (:hiddenUuid, :ownerAccountId, 'Collection hidden game', '', '', 'arcade', ARRAY[]::TEXT[], NULL,
           ARRAY[]::TEXT[], 'test/hidden.html', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 1, 'pending', 0, NULL, NOW(), NOW())
      `, { publishedUuid, hiddenUuid, ownerAccountId: gameOwnerAccountId })

      await sqlCommand.updateQuery(`
        INSERT INTO "gameCollection" ("title", "description", "slug", "status", "sortOrder", "createdAt", "updatedAt")
        VALUES ('Published only collection', 'Test collection', :slug, 'published', 0, NOW(), NOW())
      `, { slug })
      await sqlCommand.updateQuery(`
        INSERT INTO "gameCollectionItem" ("collectionId", "gameId", "sortOrder", "createdAt", "updatedAt")
        VALUES
          ((SELECT id FROM "gameCollection" WHERE slug = :slug), (SELECT id FROM "game" WHERE uuid = :publishedUuid), 0, NOW(), NOW()),
          ((SELECT id FROM "gameCollection" WHERE slug = :slug), (SELECT id FROM "game" WHERE uuid = :hiddenUuid), 1, NOW(), NOW())
      `, { slug, publishedUuid, hiddenUuid })

      const list = await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/collections?test=${slug}`,
        expectedStatus: HttpStatusCode.OK_200
      })
      const collection = (list.body.data as GameCollectionResponse[]).find(item => item.slug === slug)
      expect(collection).to.exist
      expect(collection?.gameCount).to.equal(1)
      expect(collection?.createdAt).to.be.a('string')

      const detail = await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/collections/${slug}`,
        expectedStatus: HttpStatusCode.OK_200
      })
      const collectionDetail = detail.body as GameCollectionDetailResponse
      expect(collectionDetail.gameCount).to.equal(1)
      expect(collectionDetail.total).to.equal(1)
      expect(collectionDetail.data.map(game => game.uuid)).to.deep.equal([ publishedUuid ])
    })
  })

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  describe('Events', function () {
    async function createEventFixture (slug: string, maxParticipants: number) {
      await sqlCommand.updateQuery(`
        INSERT INTO "gameEvent" (
          "title", "description", "slug", "type", "status", "maxParticipants", "participantCount", "createdByAccountId", "createdAt", "updatedAt"
        ) VALUES ('Test event', NULL, :slug, 'activity', 'upcoming', :maxParticipants, 0, :createdByAccountId, NOW(), NOW())
      `, { slug, maxParticipants, createdByAccountId: rootAccountId })
    }

    it('should return exact participation and enforce capacity with authoritative counts', async function () {
      const slug = `event-${Date.now()}`
      await createEventFixture(slug, 1)

      await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/events/${slug}/participation`,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect(res.body as GameEventParticipationResponse).to.deep.equal({ joined: false }))

      await makePostBodyRequest({
        url: server.url,
        path: `/api/v1/games/events/${slug}/join`,
        token: userAccessToken,
        fields: {},
        expectedStatus: HttpStatusCode.CREATED_201
      }).then(res => expect(res.body as GameEventJoinResponse).to.deep.equal({ joined: true, participantCount: 1 }))

      await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/events/${slug}/participation`,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect(res.body as GameEventParticipationResponse).to.deep.equal({ joined: true }))

      await makePostBodyRequest({
        url: server.url,
        path: `/api/v1/games/events/${slug}/join`,
        token: secondUserAccessToken,
        headers: { 'x-peertube-language': 'zh-Hans-CN' },
        fields: {},
        expectedStatus: HttpStatusCode.CONFLICT_409
      }).then(res => expect((res.body as GameEventErrorResponse).error).to.equal('该活动报名人数已满'))

      await makeDeleteRequest({
        url: server.url,
        path: `/api/v1/games/events/${slug}/join`,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect(res.body as GameEventJoinResponse).to.deep.equal({ joined: false, participantCount: 0 }))

      const participants = await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/events/${slug}/participants`,
        expectedStatus: HttpStatusCode.OK_200
      })
      expect((participants.body as GameEventParticipantsResponse).total).to.equal(0)
    })

    it('should return a complete event after create and normalize its capacity', async function () {
      const slug = `created-event-${Date.now()}`
      const response = await makePostBodyRequest({
        url: server.url,
        path: '/api/v1/games/events',
        token: userAccessToken,
        fields: {
          title: 'Created event',
          slug,
          description: 'Created from the API',
          maxParticipants: -5
        },
        expectedStatus: HttpStatusCode.CREATED_201
      })
      const event = response.body as GameEventResponse

      expect(event).to.include({ title: 'Created event', slug, description: 'Created from the API', maxParticipants: 0, participantCount: 0 })
      expect(event.createdBy.id).to.equal(gameOwnerAccountId)
    })

    it('should reject invalid event states and time windows', async function () {
      const invalidStatusSlug = `invalid-status-event-${Date.now()}`
      await makePostBodyRequest({
        url: server.url,
        path: '/api/v1/games/events',
        token: userAccessToken,
        fields: { title: 'Invalid status event', slug: invalidStatusSlug, status: 'draft' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      const invalidWindowSlug = `invalid-window-event-${Date.now()}`
      await makePostBodyRequest({
        url: server.url,
        path: '/api/v1/games/events',
        token: userAccessToken,
        fields: {
          title: 'Invalid window event',
          slug: invalidWindowSlug,
          startAt: '2026-08-20T12:00:00.000Z',
          endAt: '2026-08-20T11:00:00.000Z'
        },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Reservations
  // ---------------------------------------------------------------------------

  describe('Reservations', function () {
    it('should expose authoritative reservation status and toggle it', async function () {
      if (!publishedGameUuid) this.skip()

      await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/${publishedGameUuid}/reserve`,
        token: secondUserAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect((res.body as GameReservationStatusResponse).reserved).to.equal(false))

      await makePostBodyRequest({
        url: server.url,
        path: `/api/v1/games/${publishedGameUuid}/reserve`,
        token: secondUserAccessToken,
        fields: {},
        expectedStatus: HttpStatusCode.CREATED_201
      })

      await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/${publishedGameUuid}/reserve`,
        token: secondUserAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect((res.body as GameReservationStatusResponse).reserved).to.equal(true))

      await makeDeleteRequest({
        url: server.url,
        path: `/api/v1/games/${publishedGameUuid}/reserve`,
        token: secondUserAccessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Articles
  // ---------------------------------------------------------------------------

  describe('Articles', function () {
    it('should create, list, read, update, count views and delete an article', async function () {
      const slug = `article-${Date.now()}`
      const created = await makePostBodyRequest({
        url: server.url,
        path: '/api/v1/games/articles',
        token: userAccessToken,
        fields: {
          title: 'A complete game guide',
          slug,
          content: 'Start with the tutorial, then collect the hidden keys.',
          category: '攻略'
        },
        expectedStatus: HttpStatusCode.CREATED_201
      })
      const article = created.body as GameArticleResponse
      expect(article).to.include({ title: 'A complete game guide', slug, category: '攻略', viewCount: 0 })
      expect(article.summary).to.equal('Start with the tutorial, then collect the hidden keys.')
      expect(article.content).to.equal('Start with the tutorial, then collect the hidden keys.')
      expect(article.createdBy.id).to.equal(gameOwnerAccountId)

      const list = await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/articles?test=${slug}`,
        expectedStatus: HttpStatusCode.OK_200
      })
      expect((list.body.data as GameArticleResponse[]).some(item => item.slug === slug)).to.equal(true)

      const detail = await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/articles/${slug}`,
        expectedStatus: HttpStatusCode.OK_200
      })
      expect((detail.body as GameArticleResponse).content).to.equal('Start with the tutorial, then collect the hidden keys.')

      await makePostBodyRequest({
        url: server.url,
        path: `/api/v1/games/articles/${slug}/view`,
        fields: {},
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect((res.body as { viewCount: number }).viewCount).to.equal(1))

      await makePostBodyRequest({
        url: server.url,
        path: `/api/v1/games/articles/${slug}/view`,
        fields: {},
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect((res.body as { viewCount: number }).viewCount).to.equal(1))

      await makePutBodyRequest({
        url: server.url,
        path: `/api/v1/games/articles/${slug}`,
        token: userAccessToken,
        fields: { title: 'An updated game guide', summary: 'Updated summary' },
        expectedStatus: HttpStatusCode.OK_200
      }).then(res => expect(res.body as GameArticleResponse).to.include({ title: 'An updated game guide', summary: 'Updated summary' }))

      await makeDeleteRequest({
        url: server.url,
        path: `/api/v1/games/articles/${slug}`,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })

      await makeGetRequest({
        url: server.url,
        path: `/api/v1/games/articles/${slug}`,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Personal space (me/*)
  // ---------------------------------------------------------------------------

  describe('Personal space', function () {
    it('should reject personal endpoints without auth', async function () {
      const res = await fetch(`${server.url}/api/v1/games/me/favorites`)
      expect(res.status).to.equal(HttpStatusCode.UNAUTHORIZED_401)
    })

    it('should list favorites with auth', async function () {
      if (!server.accessToken) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/me/favorites`, {
        headers: { Authorization: `Bearer ${server.accessToken}` }
      })
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.data).to.be.an('array')
    })

    it('should list recent games with auth', async function () {
      if (!server.accessToken) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/me/recent`, {
        headers: { Authorization: `Bearer ${server.accessToken}` }
      })
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.data).to.be.an('array')
    })

    it('should get user level info', async function () {
      if (!server.accessToken) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/me/level`, {
        headers: { Authorization: `Bearer ${server.accessToken}` }
      })
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result).to.have.property('exp')
      expect(result).to.have.property('levelInfo')
      expect(result).to.have.property('dailyLoginAvailable')
    })

    it('should list notifications with auth', async function () {
      if (!server.accessToken) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/me/notifications`, {
        headers: { Authorization: `Bearer ${server.accessToken}` }
      })
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.data).to.be.an('array')
    })

    it('should get creator overview with auth', async function () {
      if (!server.accessToken) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/me/overview`, {
        headers: { Authorization: `Bearer ${server.accessToken}` }
      })
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result).to.have.property('games')
    })
  })

  // ---------------------------------------------------------------------------
  // Community write operations
  // ---------------------------------------------------------------------------

  describe('Community write operations', function () {
    it('should follow a game author', async function () {
      if (!server.accessToken || !publishedGameUuid) this.skip()

      const detail = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}`)
      const game = await detail.json()
      if (!game.author?.id) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/author/${game.author.id}/follow`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${server.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      expect(res.status).to.equal(HttpStatusCode.OK_200)
    })

    it('should reject coining own game', async function () {
      if (!server.accessToken || !publishedGameUuid) this.skip()

      // publishedGameUuid was uploaded by root, so root owns it
      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/coin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${server.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: 1 })
      })
      expect(res.status).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('should reject invalid coin amount', async function () {
      if (!server.accessToken || !publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/coin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${server.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: 5 })
      })
      expect(res.status).to.equal(HttpStatusCode.BAD_REQUEST_400)
    })
  })

  // ---------------------------------------------------------------------------
  // SEO & Discovery details
  // ---------------------------------------------------------------------------

  describe('SEO & discovery details', function () {
    it('should return SEO metadata for a game', async function () {
      if (!publishedGameUuid) this.skip()

      const res = await fetch(`${server.url}/api/v1/games/${publishedGameUuid}/seo`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const seo = await res.json()
      expect(seo).to.have.property('title')
      expect(seo).to.have.property('description')
      expect(seo).to.have.property('image')
      expect(seo).to.have.property('url')
    })

    it('should return search suggestions', async function () {
      const res = await fetch(`${server.url}/api/v1/games/suggest?q=%E6%B5%8B%E8%AF%95`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.data).to.be.an('array')
    })

    it('should reject short suggest query', async function () {
      const res = await fetch(`${server.url}/api/v1/games/suggest?q=a`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
      const result = await res.json()
      expect(result.data).to.have.lengthOf(0)
    })

    it('should return public feed', async function () {
      const res = await fetch(`${server.url}/api/v1/games/feed/public?count=5`)
      expect(res.status).to.equal(HttpStatusCode.OK_200)
    })
  })
})
