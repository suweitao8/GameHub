# Project Overview

GameHub is an HTML5 online games platform: players browse a game center,
play sandboxed HTML5 games directly in the browser, follow creators, join
community features (comments, discussions, events, articles), and manage
player accounts. It is built on a code base derived from PeerTube 8.x
(AGPL-3.0): the account/auth, actor/channel, permissions, job queue,
plugin, and serving infrastructure are PeerTube-derived, while the video
domain has been replaced by the game domain (`server/core/models/game/`,
`server/core/lib/games/`, `client/src/app/+games/`). The backend remains
a Node.js/Express API with Sequelize ORM (PostgreSQL) and BullMQ/Redis
job processing; the frontend is an Angular SPA.

## Repository Structure

- **apps/** — Standalone CLI applications inherited from upstream
  (`peertube-cli`, `peertube-runner`); video-era tooling kept for
  reference
- **client/** — Angular SPA：HTML5 游戏中心（`src/app/+games/`）、登录注册
  （login/signup/reset-password）、账户页与共享组件（`src/app/shared/`）
- **config/** — YAML configuration files for dev, test, and production
- **packages/** — Shared workspace packages (monorepo):
  - `core-utils/`, `models/`, `typescript-utils/`, `node-utils/`,
    `server-commands/` — shared utilities and API types
  - `ffmpeg/`, `transcription*/`, `types-generator/`, `tests/` —
    inherited from upstream; mostly video-era tooling kept for reference
- **scripts/** — Build, CI, dev, release, i18n shell scripts and the
  GameHub self-test gate (`self-test-gamehub.ps1`)
- **server/** — Backend entry point and core application code
  - `server.ts` — Process entry point
  - `core/controllers/api/games/` — GameHub REST API（游戏 CRUD、社区、
    个人库、通知、活动等）
  - `core/models/game/` — Game domain models（游戏、评论、统计、通知等）；
    上游视频域模型保留于 `core/models/video/`，仅作为基础设施被游戏作者
    信息（channel/actor）复用
  - `core/lib/games/` — Game business logic（推荐、经验值、CDN 签名、
    运行时预览、社区策略等）
  - 其余目录（middlewares、initializers、helpers 等）为上游基础设施
- **support/** — Docker 编排、Nginx 配置、OpenAPI spec 与上游文档

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
            ┌───────────────────────────────────────┐
            │         Reverse Proxy (Nginx)         │
            └──────────────────┬────────────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │          Express.js API Server              │
        │     (server/server.ts → controllers/)       │
        │                                             │
        │  /api/v1/games/*      游戏域 REST API        │
        │  /api/v1/{auth,users} 账户与权限（上游基础） │
        │  静态托管：SPA、游戏运行时、上传资源        │
        │                                             │
        │  中间件管线（鉴权/校验/限流/缓存/CSP）       │
        └──────┬────────────────────────┬─────────────┘
               │                        │
      ┌────────▼────────┐      ┌────────▼─────────┐
      │ PostgreSQL      │      │ Redis (BullMQ    │
      │ (Sequelize)：   │      │ 任务队列 + 缓存) │
      │ game 域模型 +   │      └──────────────────┘
      │ 账户/Actor 基础 │
      └─────────────────┘
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

- **Game upload（投稿）**: client 上传 HTML 包 →
  `api/games` 校验 → GameModel 入库，运行时由
  `lib/games/game-runtime.ts` 沙箱托管，封面/预览经
  `game-cdn.ts` 签名分发
- **Play & stats**: 运行时加载游戏 → play 记录/时长统计写入
  GameStatsSummaryModel / GameRecentModel
- **Community**: 评论/讨论/活动走 `api/games/community*`，
  经验值经 `lib/games/game-exp.ts` 结算

## Testing Strategy

### GameHub 质量门禁（权威）

交付前必须通过自检门禁（构建 server/client、lint、SPA 冒烟验证）：

```bash
pnpm run self-test:gamehub
```

- `-SkipBuild / -SkipLint / -SkipLive` 仅用于定位失败原因，最终交付必须补跑
- 需要审计整个 client 时加 `-FullLint`
- 后端或共享代码改动：`pnpm run build:server`
- API 改动：`pnpm run swagger-cli -- validate support/doc/api/openapi.yaml`

### 上游遗留测试套件

`packages/tests/` 保留了上游 PeerTube 的 Mocha 测试套件，绝大部分面向
视频 API 与联邦等已不再使用的领域。它们仅作为上游行为参考，不作为
GameHub 的交付标准；运行方式与 CI 配置见
[support/doc/development/tests.md](support/doc/development/tests.md)。

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
- **Vulnerability reporting**: via GitHub 私有安全通告 —
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

### Runners (inherited, video-era)

External `peertube-runner` processes were used for upstream transcoding
jobs; GameHub does not rely on them. Code kept in
`server/core/lib/runners/` for reference.

### OpenTelemetry

Tracing and metrics are instrumented via `@opentelemetry/*` packages.
Export to Jaeger (tracing) or Prometheus (metrics) is configurable in
`config/default.yaml` under the `open_telemetry` key.

## Further Reading

- [AGENTS.md 工作流约定](#通用开发工作流) — 本文件下半部分的
  GameHub 通用开发工作流
- [README.md](README.md) — 项目简介与开发环境
- [docs/development/game-community.md](docs/development/game-community.md)
  — 游戏社区功能设计文档
- [support/doc/plugins/guide.md](support/doc/plugins/guide.md)
  — 插件与主题开发指南（上游能力，部分视频扩展点已随视频域移除）
- [support/doc/api/openapi.yaml](support/doc/api/openapi.yaml)
  — OpenAPI 3.0 specification
- [support/doc/docker.md](support/doc/docker.md) — Docker deployment guide
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
6. `develop` 是唯一交付主分支。功能分支上的提交只有在快进或完成冲突解决并合并到 `develop`、且 `origin/develop` 已更新后，才算完成；只提交或推送功能分支不算完成。
7. UI 视觉微调直接基于现有页面和设计方向执行与验证，不额外询问是否开启视觉伴随或视觉精灵；只有用户明确要求对比或展示时才提供视觉方案。

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

- 交付前必须运行 `pnpm run self-test:gamehub`。该门禁会构建 server/client、运行完整 server/schema lint、检查本次变更的 client 文件、检查 GameHub 源码与全部构建 bundle，并验证 `http://127.0.0.1:9000/api/v1/ping`、SPA 入口和懒加载脚本；只有全部通过才允许向用户交付。
- `-SkipBuild`、`-SkipLint`、`-SkipLive` 只允许用于定位失败原因，不能作为最终交付结果；跳过的步骤必须在交付前补跑。
- 需要审计整个 client 时运行 `pnpm run self-test:gamehub -- -FullLint`；默认门禁不因历史遗留的 client lint 基线阻塞无关交付，但本次变更涉及的 client 文件必须通过 lint。
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

### 浏览器调试与验收

- 网页运行、交互调试、截图和 UI 验收统一使用 Codex 内置浏览器。
- 禁止使用 Chrome（包括 Chrome CDP/控制工具）或独立浏览器工具进行本项目网页调试与验收；内置浏览器不可用时报告阻塞，不得自动切换。

### 收尾与规则维护

- 完成功能后先在 worktree 提交，再合并回 `develop`、推送 `origin/develop`，最后删除当前 worktree 并执行 `git worktree prune`；清理前必须再次确认分支已合并、工作区干净且没有未注册目录。
- 每次对话结束或向用户交付前，必须执行一次收尾检查：
  1. `git status --short --branch`、`git diff --check`，确认没有本次任务遗漏的修改；已有的用户变更必须保留并明确标注，不能借清理之名删除。
  2. `git branch --show-current`、`git log -1 --oneline --decorate` 和 `git worktree list --porcelain`，确认当前基线是 `develop`，提交已落在 `develop`，且当前任务 worktree 已移除；再用 `Test-Path <task-worktree-path>` 确认目录残留也已清理。
  3. `git fetch origin --prune` 后执行以下命令，确认本地和远程主分支指向同一提交；不一致时必须继续推送或处理阻塞，不能宣称完成：
     ```powershell
     $localDevelop = git rev-parse develop
     $remoteDevelop = git rev-parse origin/develop
     if ($localDevelop -ne $remoteDevelop) { throw 'develop 尚未与 origin/develop 同步' }
     ```
  4. 对当前任务的功能分支执行 `git merge-base --is-ancestor <task-branch> develop`，确认其历史已进入主分支；合并前有冲突时必须真实解决并重新验证。
  5. 如果本地服务在本轮被启动，确认其来自主仓库或明确停止；需要保持可运行时，从 `develop` 工作区启动并检查 `http://127.0.0.1:9000/api/v1/ping`。
- 收尾检查未通过时，交付消息必须说明具体未完成项；不得用“已提交功能分支”“worktree 注册已移除”替代“已合并到主分支并完成清理”。
- 修改本文件必须立即执行“修改 → 审查 → 优化 → 提交”流程：检查命令可执行性、架构准确性、非显而易见陷阱、简洁性、时效性和可操作性；发现重复、矛盾或过时内容时当场修正。
