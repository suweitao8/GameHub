# Project Overview

PeerTube is an open-source, ActivityPub-federated video streaming platform
that uses P2P technology directly in web browsers. Developed by Framasoft
under the AGPL-3.0 license, it provides a decentralized alternative to
centralized video platforms. The server is a Node.js/Express API with a
Sequelize ORM (PostgreSQL), background job processing (BullMQ/Redis),
ActivityPub federation, and an Angular SPA client. Video transcoding is
handled via FFmpeg, with optional distributed runners.

## Repository Structure

- **apps/** — Standalone CLI applications (`peertube-cli`, `peertube-runner`)
- **client/** — Angular frontend SPA (separate build system)
- **config/** — YAML configuration files for dev, test, and production
- **packages/** — Shared workspace packages (monorepo):
  - `core-utils/` — Shared pure-JS utilities
  - `ffmpeg/` — FFmpeg wrapper library
  - `models/` — Shared TypeScript interfaces and API types
  - `node-utils/` — Node.js-specific helpers
  - `server-commands/` — HTTP client helpers used by tests
  - `tests/` — Full test suite (API, CLI, plugins, feeds, etc.)
  - `transcription/` — Speech-to-text engine integration
  - `transcription-devtools/` — Transcription benchmarking tools
  - `types-generator/` — Generates the public `@peertube/peertube-types`
    package
  - `typescript-utils/` — Generic TypeScript helpers
- **scripts/** — Build, CI, dev, release, and i18n shell scripts
- **server/** — Backend entry point and core application code
  - `server.ts` — Process entry point
  - `core/controllers/` — Express route handlers (API, ActivityPub,
    feeds, tracker)
  - `core/models/` — Sequelize database models (14 categories)
  - `core/lib/` — Business logic (transcoding, live, job queue,
    ActivityPub, plugins, runners, notifications, etc.)
  - `core/middlewares/` — Auth, rate-limiting, validation, caching, CSP
  - `core/helpers/` — Utility functions and custom validators
  - `core/initializers/` — App bootstrap, constants, DB migrations,
    config loading
  - `core/types/` — Internal TypeScript type augmentations
- **support/** — Documentation, Docker, Nginx configs, OpenAPI spec

## Build & Development Commands

### Prerequisites

- Node.js >= 22.x
- pnpm >= 10.9 (do **not** use npm or yarn for install)
- PostgreSQL >= 10 with `pg_trgm` and `unaccent` extensions
- Redis >= 6.x
- FFmpeg >= 4.3
- Python >= 3.8 (for some test tooling)

### Install dependencies

```bash
pnpm install --frozen-lockfile
```

### Build

```bash
# Build server only (backend work)
npm run build:server

# Build full application (server + client)
npm run build

# Build tests
npm run build:tests

# Build individual apps
npm run build:peertube-cli
npm run build:peertube-runner
```

### Development

```bash
# Server-only with hot reload (recommended for backend work)
npm run dev:server        # http://localhost:9000

# Full stack (server + Angular client)
npm run dev               # server :9000, client :3000

# Dev credentials: root / test
```

### Lint & type-check

```bash
# Full lint (oxlint + OpenAPI validation)
npm run lint

# Oxlint only
npm run oxlint

# Validate OpenAPI spec
npm run swagger-cli -- validate support/doc/api/openapi.yaml

# TypeScript compilation check
npm run tsc -b server/tsconfig.json
```

### Run in production

```bash
npm run start              # server + client
npm run start:server       # server only (--no-client)
```

## Code Style & Conventions

### Formatting (enforced by Oxlint)

| Rule                | Value                                 |
|---------------------|---------------------------------------|
| Semicolons          | **never** (`@stylistic/semi`)         |
| Max line length     | 140 characters                        |
| Quotes              | Single quotes (TypeScript default)    |
| Array brackets      | Spaces inside `[ 'a', 'b' ]`         |
| Trailing newline    | Required (`eol-last`)                 |
| Indentation         | 2 spaces (TypeScript convention)      |

### Naming patterns

- Database models: `VideoModel`, `UserModel` — PascalCase + `Model` suffix
- Internal type aliases: `MVideo`, `MVideoWithChannel` — `M` prefix for
  Sequelize model types with specific association requirements
- Controllers: one file per resource, registered in parent `index.ts`
- Validators: mirror controller structure under
  `server/core/middlewares/validators/`

### Controller pattern

```typescript
import express from 'express'
import { apiRateLimiter, asyncMiddleware } from '../../middlewares/index.js'

const router = express.Router()
router.use(apiRateLimiter)  // always include rate limiting

router.get('/:id',
  validationMiddleware,     // always validate inputs
  asyncMiddleware(handler)  // always wrap async handlers
)
```

### Commit messages

No formal commit-message template.

### Oxlint config

Defined in `oxlint.config.mjs`. Applies to `server/**/*.ts`,
`scripts/**/*.ts`, `packages/**/*.ts`, `apps/**/*.ts`. The `client/`
directory has its own lint config.

## Architecture Notes

```
                  ┌──────────────────────────────────────────┐
                  │            Reverse Proxy (Nginx)         │
                  └──────────────┬───────────────────────────┘
                                 │
              ┌──────────────────▼──────────────────────┐
              │          Express.js API Server           │
              │  (server/server.ts → core/controllers/)  │
              │                                          │
              │  ┌─────────┐ ┌──────────┐ ┌──────────┐  │
              │  │  REST   │ │Activity- │ │  Feeds/  │  │
              │  │  API    │ │  Pub     │ │  oEmbed  │  │
              │  │  /api/* │ │  /inbox  │ │  /feeds  │  │
              │  └────┬────┘ └────┬─────┘ └────┬─────┘  │
              │       │           │             │        │
              │  ┌────▼───────────▼─────────────▼────┐  │
              │  │       Middleware Pipeline          │  │
              │  │  (auth, validators, rate-limit)    │  │
              │  └────────────────┬───────────────────┘  │
              │                   │                      │
              │  ┌────────────────▼───────────────────┐  │
              │  │        Business Logic (lib/)       │  │
              │  │  videos, live, transcoding,        │  │
              │  │  federation, notifications,        │  │
              │  │  plugins, runners                  │  │
              │  └──┬──────────┬──────────────┬───┘   │
              └─────┼──────────┼──────────────┼───────┘
                    │          │              │
          ┌────────▼──┐ ┌─────▼─────┐ ┌──────▼──────┐
          │PostgreSQL │ │   Redis   │ │  FFmpeg /   │
          │(Sequelize)│ │ (BullMQ   │ │  Runners    │
          │           │ │  + cache) │ │             │
          └───────────┘ └───────────┘ └─────────────┘
```

**Startup sequence** (`server/server.ts`):

1. Register OpenTelemetry tracing
2. Pre-init checks (config, FFmpeg, Node.js version)
3. Connect to PostgreSQL, run migrations
4. Initialize Sequelize models and load i18n
5. Configure Express middleware stack (proxy trust, CSP, CORS,
   rate-limiting, OAuth2 auth, express-validator)
6. Mount route controllers and start listening

**Key data flows**:

- **Video upload**: REST API → validator middleware → `lib/video.ts` →
  job queue → FFmpeg transcoding → HLS/web-video files → object
  storage or local filesystem
- **Federation**: Incoming ActivityPub requests → signature
  verification → `lib/activitypub/` processors → local DB updates +
  outgoing fan-out
- **Live streaming**: RTMP ingest → FFmpeg segmenter → HLS manifest →
  P2P delivery via WebSocket tracker

## Testing Strategy

### Test framework

- **Mocha** for all server/API tests
- **GNU Parallel** for running test files concurrently in CI
- Tests live in `packages/tests/src/` (TypeScript source) and are
  compiled to `packages/tests/dist/`

### Preparation

```bash
# Create PostgreSQL superuser for test DB management
sudo -u postgres createuser $(whoami) --createdb --superuser

# Clean test databases
npm run clean:server:test

# Build server + tests
npm run build:server
npm run build:tests
```

### Running tests

```bash
# Full suite (slow, ~45-60 min)
npm run test

# Run a specific CI suite
npm run ci -- api-1       # check-params, notifications, search
npm run ci -- api-2       # live, server plugins, users
npm run ci -- api-3       # videos, stats
npm run ci -- api-4       # moderation, redundancy, object-storage,
                          # activitypub
npm run ci -- api-5       # transcoding, runners
npm run ci -- client      # feeds, client, misc-endpoints, plugins
npm run ci -- cli-plugin  # CLI and plugin tests
npm run ci -- lint        # OXlint + OpenAPI validation + client lint
npm run ci -- transcription
npm run ci -- external-plugins

# Run a single test file
npm run mocha -- --timeout 30000 --exit --bail \
  packages/tests/src/api/videos/single-server.ts
```

### External test dependencies (Docker)

Some tests require these containers:

```bash
docker run -p 9444:9000 chocobozzz/s3-ninja
docker run -p 10389:10389 chocobozzz/docker-test-openldap
docker run -p 8082:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  chocobozzz/peertube-tests-keycloak
```

### CI pipeline

GitHub Actions (`.github/workflows/test.yml`), Ubuntu 22.04, Node.js
22.x. Matrix strategy runs suites in parallel: `types-package`,
`client`, `api-1`–`api-5`, `cli-plugin`, `lint`, `transcription`,
`external-plugins`.

Services provisioned per job: PostgreSQL 10, Redis, LDAP, S3 Ninja,
Keycloak.

### Environment variables for tests

| Variable                                   | Purpose                     |
|--------------------------------------------|-----------------------------|
| `DISABLE_HTTP_IMPORT_TESTS=true`           | Skip flaky HTTP import tests|
| `DISABLE_HTTP_YOUTUBE_IMPORT_TESTS=true`   | Skip YouTube import tests   |
| `ENABLE_OBJECT_STORAGE_TESTS=true`         | Enable S3 tests             |

## Security & Compliance

- **License**: AGPL-3.0 — all network-facing modifications must be
  published under the same license.
- **Secrets**: The `secrets.peertube` key in `config/*.yaml` must be
  generated via `openssl rand -hex 32`. Never commit secrets; use
  `config/local-*.json` overrides (gitignored) or environment variables.
- **OAuth2**: Access tokens expire in 1 day; refresh tokens in 2 weeks
  (configurable in `config/default.yaml`).
- **Rate limiting**: All API endpoints are rate-limited by default
  (`apiRateLimiter` middleware). Specific limits per category (login,
  signup, ActivityPub, etc.) are configured in `config/default.yaml`.
- **CSP**: Content-Security-Policy headers are configurable and applied
  via `server/core/middlewares/csp.ts`.
- **Input validation**: Every controller uses express-validator
  middleware defined in `server/core/middlewares/validators/`.
- **Vulnerability reporting**: `peertube-security@framasoft.org` —
  see `SECURITY.md`.
- **Dependency scanning**: No automated scanner configuration found in
  the repo.

## Agent Guardrails

### Files and directories agents must NOT modify

- `config/local-*.json` — User-local config overrides (gitignored)
- `config/production.yaml.example` — Template; changes need release
  coordination
- `server/core/initializers/migrations/` — Existing migration files are
  immutable once released; only append new ones
- `pnpm-lock.yaml` — Regenerated by `pnpm install`; never edit manually
- `support/doc/api/openapi.yaml` — Must stay in sync with controllers;
  validate with `npm run swagger-cli -- validate`

### Required checks before pushing

1. `npm run build:server` must succeed
2. `npm run lint` must pass
3. If API surface changed: `npm run swagger-cli -- validate
   support/doc/api/openapi.yaml`
4. If database schema changed: create a new migration file **and**
   increment `LAST_MIGRATION_VERSION` in
   `server/core/initializers/constants.ts`

### Boundaries

- Do not run `pnpm install` without `--frozen-lockfile`
- Do not use `npm install` or `yarn` — this project uses **pnpm**
- Do not add dependencies without explicit approval
- Do not modify test Docker images or CI service definitions without
  review
- Maximum concurrency for background jobs is configured in constants;
  do not change without benchmarking

## Extensibility Hooks

### Plugin system

PeerTube supports server and client plugins via a hook-based
architecture. Plugins register `filter`, `action`, and `static`
hooks—see `support/doc/plugins/guide.md`.

- Plugin names follow `peertube-plugin-*` (themes: `peertube-theme-*`)
- Server hooks are registered in `server/core/lib/plugins/`
- Plugin management API: `/api/v1/plugins`
- Install/uninstall scripts: `npm run plugin:install`,
  `npm run plugin:uninstall`

### Configuration

All runtime configuration is in YAML under `config/`. Local overrides
use `config/local-*.json` files (gitignored). Key env vars:

| Variable              | Purpose                              |
|-----------------------|--------------------------------------|
| `NODE_ENV`            | `production`, `development`, `test`  |
| `NODE_CONFIG_DIR`     | Override config directory             |
| `LOGGER_LEVEL`        | `debug`, `info`, `warn`, `error`     |
| `PT_INITIAL_ROOT_PASSWORD` | Set root password on first run  |

### Runners (distributed transcoding)

External `peertube-runner` processes poll the API for transcoding jobs.
Configured in `server/core/lib/runners/` and managed through the
`/api/v1/runners` endpoints.

### OpenTelemetry

Tracing and metrics are instrumented via `@opentelemetry/*` packages.
Export to Jaeger (tracing) or Prometheus (metrics) is configurable in
`config/default.yaml` under the `open_telemetry` key.

## Further Reading

- [support/doc/development/server.md](support/doc/development/server.md)
  — Server code conventions and new-feature walkthrough
- [support/doc/development/tests.md](support/doc/development/tests.md)
  — Test setup and execution guide
- [support/doc/plugins/guide.md](support/doc/plugins/guide.md)
  — Plugin & theme development guide
- [support/doc/api/openapi.yaml](support/doc/api/openapi.yaml)
  — OpenAPI 3.0 specification
- [support/doc/production.md](support/doc/production.md)
  — Production deployment guide
- [support/doc/docker.md](support/doc/docker.md)
  — Docker deployment guide
- [support/doc/development/lib.md](support/doc/development/lib.md)
  — Library / business-logic documentation
- [SECURITY.md](SECURITY.md) — Vulnerability disclosure policy
- [FAQ.md](FAQ.md) — Frequently asked questions

## 通用开发工作流

### 规则作用域

- 根目录 `AGENTS.md` 是项目级工作流和后端/仓库规则的权威入口。
- `client/AGENTS.md` 是 Angular 客户端目录的补充规则；进入 `client/` 开发时，两份规则同时生效，冲突时以更具体的客户端规则为准。
- 不维护重复的 `CLAUDE.md`；若以后出现，应把有效内容合并到对应的 `AGENTS.md` 后删除重复文件。

### 核心约定

1. 功能、修复、重构默认不得直接修改主工作区；使用独立 worktree 完成代码、验证和提交。规则/文档类变更可直接改主工作区，但仍需做质量审查。
2. 对话、计划、提交信息和规则文档使用中文；代码标识符遵循现有英文命名。
3. 没有实际验证证据，不得声称“已完成”“已修复”或“可以运行”。
4. 设计方向已明确后直接执行；只有范围、风险或关键取舍发生变化且代码无法合理推断时才暂停提问。
5. 只管理当前任务创建的 worktree，不修改或删除其他会话的 worktree、分支和本地运行数据。

### 开发前与开发中

先确认仓库状态和当前位置：

```powershell
git status --short --branch
git branch --show-current
git worktree list --porcelain
```

代码任务默认在仓库外的 `D:\Github\_worktrees\GameHub\<task-name>` 创建 worktree：

```powershell
git worktree add "D:\Github\_worktrees\GameHub\<task-name>" -b "codex/<task-name>" develop
Set-Location "D:\Github\_worktrees\GameHub\<task-name>"
pnpm install --frozen-lockfile
```

保持改动手术式、范围最小；不要把依赖安装产物、构建产物、日志、截图或本地数据库数据提交进仓库。安装/构建产生的真实 lockfile 或工作区配置变化如果影响复现，则必须保留并审查。

### 提交前验证

- 所有后端或共享代码改动：`pnpm run build:server`。
- 需要完整仓库质量检查时：`pnpm run lint`。
- API 改动：`pnpm run swagger-cli -- validate support/doc/api/openapi.yaml`。
- 启动验证：确认 PostgreSQL、Redis、FFmpeg 可用，启动后检查 `http://127.0.0.1:9000/api/v1/ping` 返回成功响应，并检查服务日志没有启动级错误。
- 提交前运行 `git diff --check`，再确认 `git status --short` 只包含预期文件。

### 本地开发部署

推荐用仓库提供的开发依赖编排启动 PostgreSQL 和 Redis：

```powershell
docker compose -f support/docker/development/docker-compose.yml up -d
pnpm install --frozen-lockfile
pnpm run build:server
pnpm run build:client
$env:NODE_ENV = 'dev'
$env:NODE_CONFIG = '{"redis":{"port":6381}}'
pnpm run start
```

服务默认监听 `http://127.0.0.1:9000`。停止开发依赖使用：

```powershell
docker compose -f support/docker/development/docker-compose.yml down
```

### 收尾与规则维护

- 完成功能后先在 worktree 提交，再合并回开发基线、推送并删除当前 worktree，最后执行 `git worktree prune`；清理前必须再次确认分支已合并、工作区干净且没有未注册目录。
- 修改本文件必须立即执行“修改 → 审查 → 优化 → 提交”流程：检查命令可执行性、架构准确性、非显而易见陷阱、简洁性、时效性和可操作性；发现重复、矛盾或过时内容时当场修正。
