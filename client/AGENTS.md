# Client — Angular Frontend SPA

GameHub 的客户端是一个 Angular 单页应用，经 `/client/` 前缀由后端
托管，仅通过 REST API（`/api/v1/`，主要是 `/api/v1/games/*`）与后端
通信。用户可见的产品形态是 HTML5 游戏中心；上游 PeerTube 的视频页面、
管理后台与播放器 UI 已从路由中移除，旧路径统一重定向到游戏中心。

## Directory Structure

- **src/app/** — Main Angular application
  - `+games/` — 游戏中心懒加载模块：首页、游戏详情/运行时、投稿、
    社区（评论/讨论/活动）、个人库、通知等
  - `+login/`, `+signup/`, `+reset-password/` — 账户相关懒加载模块
    （目录前缀 `+` 表示 lazy-loaded route module）
  - `game-about`, `game-account-*`, `game-not-found` 等根级组件 —
    关于页、账户主页/设置、404 页
  - `core/` — Singleton services: auth, routing, plugins, theme,
    server config, screen-size helpers
  - `shared/` — 共享组件与服务，按域组织（`shared-forms/`,
    `shared-main/`, `shared-icons/` 等）
  - `header/`, `menu/`, `modal/` — App shell layout components
  - `helpers/` — Client-side utility functions
  - `hotkeys/` — Keyboard shortcut definitions
  - `app.routes.ts` — Top-level route definitions；所有视频/后台旧
    路径（videos、admin、my-library 等）在此重定向到 `/games`
  - `app.component.ts` — Root component
- **src/root-helpers/** — Framework-agnostic helpers (logger, storage,
  theme manager, translations, plugin manager) shared between the
  main app and standalone builds
- **src/standalone/** — Independently built artifacts inherited from
  upstream (`player/`、`embed-player-api/`、`videos/`)；GameHub 页面
  不引用它们，仅随构建脚本保留
- **src/sass/** — Global SCSS: Bootstrap overrides, PrimeNG theme,
  utility classes, z-index scale, fonts
- **src/locale/** — Angular XLIFF translation files
- **src/assets/** — Static images and assets（含游戏封面等）
- **src/environments/** — Angular environment configs
- **proxy.config.json** — Dev-server proxy to backend (:9000)

## Build & Development Commands

All commands run from the **repository root** unless noted.

### Development

```bash
# Full stack: server (:9000) + Angular dev server (:3000)
pnpm run dev

# Client only (requires a running backend on :9000)
pnpm run dev:client

# Light en-US production build on Windows（自检门禁使用）
pnpm run build:client:light
```

The Angular dev server proxies `/api`, `/plugins`, `/themes`,
`/static`, `/lazy-static`, `/socket.io`, and `/client/assets` to the
backend at `http://127.0.0.1:9000` (see `proxy.config.json`).

### Build

```bash
# Full client build (production, all locales)
pnpm run build:client
```

Output goes to `client/dist/browser/<locale>/`.

### Lint

```bash
cd client
npm run lint        # TypeScript + templates + SCSS
```

根门禁默认只对本次变更的 client 文件执行 lint；需要全量审计用
`pnpm run self-test:gamehub -- -FullLint`。

## Code Style & Conventions

### TypeScript / Lint

The client has its own lint config（ESLint 家族规则），关键约束与
server 一致：

| Rule                | Value                             |
|---------------------|-----------------------------------|
| Semicolons          | **never** (`@stylistic/semi`)     |
| Max line length     | 140 characters                    |
| Array brackets      | Spaces inside `[ 'a', 'b' ]`     |
| Trailing newline    | Required (`eol-last`)             |
| Indentation         | 2 spaces                          |

### Angular-specific rules

| Rule                                     | Value                    |
|------------------------------------------|--------------------------|
| Component selector prefix               | `my-` (kebab-case)       |
| Directive selector prefix               | `my` (camelCase)         |
| View encapsulation                       | Required (enforced)      |

### SCSS / Stylelint

Configured in `.stylelintrc.json`, extends
`stylelint-config-sass-guidelines` with `stylelint-order`. Key rules:

- Declaration order: custom properties → declarations → `@include`
- Max nesting depth: 8
- Max compound selectors: 9
- `::ng-deep` pseudo-element allowed

### Naming patterns

- Lazy-loaded route folders: `+feature-name/`（如 `+games/`、`+login/`）
- Shared modules: `shared-domain/`（如 `shared-forms/`、`shared-main/`）
- Services: PascalCase with `Service` suffix
  (`AuthService`, `GamesService`)
- Components: PascalCase with `Component` suffix, selector prefixed
  `my-`（如 `my-game-card`）；游戏域新组件亦使用 `game-` 命名前缀的文件名
- Path aliases: `@app/*` → `src/app/*`,
  `@root-helpers/*` → `src/root-helpers/*`

### Internationalization

- Source locale: `en` (base href `/client/en-US/`)
- Translation files: XLIFF format in `src/locale/`
- Merge tool: `@peertube/xliffmerge` (config: `.xliffmerge.json`)
- Use Angular `$localize` / `i18n` attributes; do NOT use raw strings
  for user-visible text

## Architecture Notes

```
┌────────────────────────────────────────────────────────┐
│                 Angular SPA (client/)                   │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Routes   │  │  Core        │  │  Shared          │  │
│  │ (+games,  │  │ (auth, REST, │  │ (forms, icons,   │  │
│  │  login,   │──│  plugins,    │──│  actor-image,    │  │
│  │  signup…) │  │  server,     │  │  main…)          │  │
│  │           │  │  theme)      │  │                  │  │
│  └──────────┘  └──────┬───────┘  └──────────────────┘  │
│                        │                                │
│  ┌─────────────────────▼────────────────────────────┐   │
│  │           root-helpers (no Angular dep)           │   │
│  │  logger, storage, plugins-manager, theme, i18n   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  视频时代遗留：standalone/player 与 embed 仅随脚本保留， │
│  SPA 运行时不加载                                        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (REST API)
                         ▼
              ┌──────────────────────────┐
              │  Express Backend         │
              │  (:9000 /api/v1/games/*) │
              └──────────────────────────┘
```

- **Lazy loading**: Each `+feature/` folder exports route configs
  loaded via `loadChildren` in `app.routes.ts`
- **Core services**: Singletons bootstrapped in `main.ts` via
  `getCoreProviders()` — auth, REST client, server config polling,
  plugin hooks, theme manager
- **State management**: No dedicated store library; services hold
  state, components subscribe via RxJS observables / signals
- **UI framework**: Bootstrap 5 + PrimeNG + ng-bootstrap;
  global SCSS in `src/sass/`
- **Game runtime**: 上传的 HTML 包由后端沙箱托管，客户端在
  `+games/game-play` 通过 iframe 加载 `/api/v1/games/:uuid/runtime/`

## Agent Guardrails

### Files agents must NOT modify

- `src/locale/*.xlf` — Generated translation files; updated via
  `npm run i18n:update` only
- `dist/` — Build output; never edit manually
- `node_modules/` — Managed by pnpm
- `.angular/` — Angular build cache

### Required checks before pushing

1. 根目录 `pnpm run self-test:gamehub` 必须通过
2. 生产构建必须成功（门禁内含 en-US light build）
3. 新增用户可见文案需走 `$localize` / i18n 属性

### Boundaries

- Do not import from `server/` — the client communicates with the
  backend exclusively via the REST API
- Do not import Angular-specific code in `root-helpers/` or
  `standalone/` — these must remain framework-agnostic
- Shared API types come from `@peertube/peertube-models` and
  `@peertube/peertube-core-utils` (workspace packages)
- 不要重新引入视频域页面或组件；删除残留时应先确认无引用
- Do not add new npm dependencies without explicit approval

## Further Reading

- [../docs/development/game-community.md](../docs/development/game-community.md)
  — 游戏社区功能设计文档
- [../support/doc/plugins/guide.md](../support/doc/plugins/guide.md)
  — Plugin & theme development (client hooks)
- [../support/doc/api/openapi.yaml](../support/doc/api/openapi.yaml)
  — OpenAPI specification
- [../AGENTS.md](../AGENTS.md)
  — Root project AGENTS.md (server, build, workflow)
