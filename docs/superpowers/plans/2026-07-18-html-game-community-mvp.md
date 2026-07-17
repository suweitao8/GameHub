# HTML Game Community MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tested PeerTube MVP where authenticated creators upload moderated single-file HTML games and players discover and run them in a restricted isolated container while reusing PeerTube community capabilities.

**Architecture:** Add a `GameModel` and `/api/v1/games` boundary without renaming or deleting Video. Store runtime files outside the client and media roots, expose them through a dedicated runtime response with strict CSP, and use an Angular game shell that delegates comments, ratings, playlists, follows, reports, and author links to existing PeerTube services.

**Tech Stack:** TypeScript, Express, Sequelize/Sequelize-Typescript, PostgreSQL migrations, Angular lazy routes, existing PeerTube auth/middleware, Mocha/Chai API tests, Playwright browser verification.

---

### Task 1: Add the Game persistence contract

**Files:**
- Create: `server/core/models/game/game.ts`
- Create: `server/core/types/models/game/game.ts`
- Create: `server/core/helpers/custom-validators/games.ts`
- Create: `server/core/initializers/migrations/1086-games.ts`
- Modify: `server/core/initializers/database.ts`
- Modify: `server/core/initializers/constants.ts:LAST_MIGRATION_VERSION`
- Test: `packages/tests/src/api/games/game-model.ts`

- [ ] **Step 1: Write the failing model contract test**

Add a test that creates a pending game with a user owner, asserts the enum-like status and UUID are persisted, and rejects a second row with the same UUID. The test must use the existing database helpers and clean the created row in `afterEach`.

```ts
it('persists a pending game with an opaque public uuid', async function () {
  const game = await GameModel.create({
    uuid: 'test-game-uuid', ownerAccountId: userAccountId, title: 'Test game',
    description: '', instructions: '', category: 'arcade', tags: [ 'test' ],
    status: 'pending', runtimePath: 'games/test/index.html', runtimeSha256: 'a'.repeat(64),
    fileSizeBytes: 42, playCount: 0
  })

  expect(game.status).to.equal('pending')
  expect(game.uuid).to.equal('test-game-uuid')
  await expect(GameModel.create({ ...game.toJSON(), id: undefined })).to.be.rejected
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `pnpm run build:tests` after the test is registered, then run the generated focused Mocha file. Expected failure: the Game model, migration, or model registration does not exist.

- [ ] **Step 3: Implement the model and migration**

Define `GameStatus` as a string union, add Sequelize columns and indexes for `uuid`, `status`, `ownerAccountId`, `category`, `publishedAt`, and `createdAt`, and create the table in migration 1086. Add the model to `sequelizeTypescript.addModels([...])` and set `LAST_MIGRATION_VERSION = 1086`. The migration must use the existing `queryInterface.createTable` style and `down()` must throw `Not implemented.`.

- [ ] **Step 4: Run the focused model test and type-check**

Run `pnpm run tsc -b server/tsconfig.json` and the focused model test. Expected: the model test passes and no server TypeScript errors are introduced.

- [ ] **Step 5: Commit**

```powershell
git add server/core/models/game server/core/types/models/game server/core/helpers/custom-validators/games.ts server/core/initializers/migrations/1086-games.ts server/core/initializers/database.ts server/core/initializers/constants.ts packages/tests/src/api/games/game-model.ts
git commit -m "feat: add game content model"
```

### Task 2: Implement upload validation and isolated runtime storage

**Files:**
- Create: `server/core/lib/games/game-runtime.ts`
- Create: `server/core/lib/games/game-upload.ts`
- Create: `server/core/controllers/api/games/runtime.ts`
- Modify: `config/default.yaml`
- Modify: `config/dev.yaml`
- Test: `packages/tests/src/api/games/game-runtime.ts`

- [ ] **Step 1: Write failing security tests**

Cover the accepted minimal HTML, rejection of `.zip`, non-HTML MIME, over-limit payload, `<script src="https://...">`, `fetch(`, `XMLHttpRequest`, `window.top`, `window.parent`, `..` path fragments, and a symlink source. Assert that accepted files are stored below the configured runtime root with a generated directory and `index.html` only.

```ts
it('rejects an HTML file that references an external script', async function () {
  await expect(validateSingleHtmlGame(Buffer.from('<script src="https://evil.test/a.js"></script>')))
    .to.be.rejectedWith('External resources are not supported')
})
```

- [ ] **Step 2: Run tests and confirm red**

Run `pnpm exec mocha --import=tsx packages/tests/src/api/games/game-runtime.ts`. Expected failure: the upload validator and runtime service are undefined.

- [ ] **Step 3: Implement the minimum safe storage service**

Read the configured maximum bytes before writing, parse as UTF-8, enforce one HTML document, reject forbidden external/network/top-navigation patterns, compute SHA-256, and write only to a random opaque directory under `CONFIG.STORAGE.GAMES_DIR`. Resolve the final path and verify it remains inside the root. Set runtime headers: `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a CSP that denies network connections, forms, objects, parent frames, top navigation, and external scripts/resources.

- [ ] **Step 4: Add the runtime route and configuration**

Expose only published games through `GET /api/v1/games/:uuid/runtime`, never attach the authenticated user context or cookies to the runtime response, and return 404 for all non-published states. Add development defaults for a dedicated runtime origin and limits: 1 MiB per file, 100 MiB per account, 10 uploads per hour, and mandatory moderation for non-admin users.

- [ ] **Step 5: Run security tests and type-check**

Run the focused runtime tests and `pnpm run tsc -b server/tsconfig.json`. Expected: all forbidden-input and header tests pass.

- [ ] **Step 6: Commit**

```powershell
git add server/core/lib/games server/core/controllers/api/games/runtime.ts config/default.yaml config/dev.yaml packages/tests/src/api/games/game-runtime.ts
git commit -m "feat: isolate html game runtime"
```

### Task 3: Add authenticated Game APIs and moderation

**Files:**
- Create: `server/core/controllers/api/games/index.ts`
- Create: `server/core/controllers/api/games/moderation.ts`
- Create: `server/core/middlewares/validators/games.ts`
- Modify: `server/core/controllers/api/index.ts`
- Test: `packages/tests/src/api/games/games.ts`

- [ ] **Step 1: Write failing API tests**

Test unauthenticated list/detail, creator upload creating `pending`, owner-only update/delete, admin approve/reject/unlist/block, non-admin moderation rejection, and list filtering so pending games are not visible publicly.

```ts
it('keeps pending games out of the public list', async function () {
  const res = await server.get('/api/v1/games')
  expect(res.body.data.some((game: any) => game.uuid === pendingUuid)).to.equal(false)
})
```

- [ ] **Step 2: Run the focused API test and verify red**

Run the focused Mocha file against the test server. Expected failure: `/api/v1/games` is not mounted.

- [ ] **Step 3: Implement validators, authorization, and controllers**

Use existing `express-validator`, `asyncMiddleware`, auth, rate-limit, and admin middleware patterns. Parse metadata with bounded lengths, normalize tags, call the upload service, create an audit record, and return only fields needed by the game client. The moderation endpoint accepts exactly `approve`, `reject`, `unlist`, and `block`; transitions must be explicit and invalid transitions return a 400/409 problem response.

- [ ] **Step 4: Mount and verify the API**

Mount `gamesRouter` at `/games` in `server/core/controllers/api/index.ts`, build the server and rerun the focused API test. Expected: public filtering, ownership checks, admin checks, and rate limits pass.

- [ ] **Step 5: Commit**

```powershell
git add server/core/controllers/api/games server/core/middlewares/validators/games.ts server/core/controllers/api/index.ts packages/tests/src/api/games/games.ts
git commit -m "feat: add game upload and moderation api"
```

### Task 4: Add the player and creator Angular surfaces

**Files:**
- Create: `client/src/app/+games/routes.ts`
- Create: `client/src/app/+games/games.service.ts`
- Create: `client/src/app/+games/games-home.component.ts`
- Create: `client/src/app/+games/games-home.component.html`
- Create: `client/src/app/+games/game-play.component.ts`
- Create: `client/src/app/+games/game-play.component.html`
- Create: `client/src/app/+games/game-play.component.scss`
- Modify: `client/src/app/app.routes.ts`
- Modify: `client/src/app/+home/routes.ts`
- Test: `client/src/app/+games/games.service.spec.ts`

- [ ] **Step 1: Write the failing service test**

Assert that `GamesService.list()` calls `/api/v1/games` with `sort`, `category`, and `search`, and that `runtimeUrl()` uses the opaque API URL rather than concatenating user-controlled paths.

- [ ] **Step 2: Run the focused client test and verify red**

Run the Angular test command for the new spec. Expected failure: the service and routes do not exist.

- [ ] **Step 3: Implement the game home and play shell**

Build a responsive card grid with cover, title, summary, author, play count, rating, update time, category, and tags. The play page must render an iframe with exactly `sandbox="allow-scripts"`, `allow="fullscreen"`, `referrerpolicy="no-referrer"`, a reload button, load-error message, metadata, author link, and existing interaction components/services where their API expects a Video identifier.

- [ ] **Step 4: Route and replace the default home entry**

Add `/games` and `/games/:uuid`; make the default home route render the games home while preserving `/videos`, `/w`, upload, and admin routes for compatibility during migration. Hide ordinary video publish/live/import links from the default navigation for non-admin users.

- [ ] **Step 5: Build and run browser verification**

Run the client build, start the local server, and verify `/`, `/games`, and `/games/<uuid>` render with HTTP 200 and the iframe attributes are present.

- [ ] **Step 6: Commit**

```powershell
git add client/src/app/+games client/src/app/app.routes.ts client/src/app/+home/routes.ts
git commit -m "feat: add game discovery and play pages"
```

### Task 5: Reuse community interactions and creator/admin views

**Files:**
- Modify: `client/src/app/+games/game-play.component.ts`
- Modify: `client/src/app/+games/game-play.component.html`
- Create: `client/src/app/+games/game-manage.component.ts`
- Create: `client/src/app/+games/game-manage.component.html`
- Create: `client/src/app/+games/game-admin.component.ts`
- Create: `client/src/app/+games/game-admin.component.html`
- Modify: `client/src/app/+my-library/routes.ts`
- Modify: `client/src/app/+admin/admin.routes.ts`
- Test: `packages/tests/src/api/games/community-adapter.ts`

- [ ] **Step 1: Write failing adapter tests**

Verify that a Game with a Video shell exposes the shell UUID to existing comment/rate/playlist/follow/report services, and that no adapter can attach an unpublished or blocked Game to a public interaction request.

- [ ] **Step 2: Implement the adapter and views**

Use existing PeerTube endpoints for comments, ratings, playlists/favorites, subscriptions/follows, notifications, and abuse reports. Add creator forms for metadata/file replacement, status display, unlist/delete, and basic stats. Add admin actions for moderation and user ban navigation; do not create duplicate account or permission logic.

- [ ] **Step 3: Verify player and creator flows**

Use the `suweitao` administrator plus a regular test user to exercise login, published-game interaction, owner isolation, and admin moderation. Add a Playwright flow covering discover → play → reload → comment/rate/favorite → author link.

- [ ] **Step 4: Commit**

```powershell
git add client/src/app/+games client/src/app/+my-library/routes.ts client/src/app/+admin/admin.routes.ts packages/tests/src/api/games/community-adapter.ts
git commit -m "feat: connect game community interactions"
```

### Task 6: Full verification and deployment handoff

**Files:**
- Modify: `support/docker/development/docker-compose.yml` if the runtime service needs a dedicated origin
- Modify: `support/doc/development/game-community-analysis.md`
- Modify: `support/doc/development/server.md` or add `support/doc/development/games.md`
- Test: `packages/tests/src/api/games/*.ts`, browser verification artifacts

- [ ] **Step 1: Run static checks**

Run `pnpm run tsc -b server/tsconfig.json`, `pnpm run oxlint`, and the relevant client build. Run OpenAPI validation if the API contract is added to the specification.

- [ ] **Step 2: Run focused and regression tests**

Run every Game API/security test plus the existing user, moderation, search, notification, and video tests that exercise touched code. Record exact counts and failures.

- [ ] **Step 3: Start the local stack and verify endpoints**

Start PostgreSQL/Redis with the existing compose file, run the server using the configured portable Node 22 runtime, check `/api/v1/ping`, `/`, `/games`, runtime headers, and database migration state.

- [ ] **Step 4: Run browser security verification**

Confirm in the browser that the game iframe has no `allow-same-origin`, game `document.cookie` is empty, top-level navigation is blocked, external network requests are denied, the reload control works, and the main-site session remains usable after gameplay.

- [ ] **Step 5: Review requirements and commit only verified work**

Run `git diff --check`, inspect `git status`, compare each objective requirement with a concrete test or runtime artifact, update the docs with any configured ports/limits, and push the verified branch only after all required checks pass.
