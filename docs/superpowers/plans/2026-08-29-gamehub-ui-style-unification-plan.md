# GameHub 全局 UI 样式统一实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 GameHub 路由、业务状态和游戏运行安全边界的前提下，统一当前 SPA 的令牌、控件、表面、状态反馈、响应式间距和浮层样式，并用静态契约、构建和真实浏览器证明收口结果。

**Architecture:** 保留 `client/src/app/+games/game-community.tokens.scss` 作为 GameHub 视觉令牌源，新增全局兼容/基础控件层，将 PeerTube/Bootstrap/PrimeNG 的公共控件映射到 GameHub 令牌。页面组件继续保留本地布局，只迁移重复的颜色、圆角、阴影、尺寸和状态规则；游戏运行舞台、截图灯箱及第三方分享品牌色保留为带说明的特例。

**Tech Stack:** Angular、SCSS、Bootstrap 5、PrimeNG、ng-bootstrap、Node.js 静态契约脚本、PowerShell、真实浏览器/Playwright。

---

## 文件结构与职责

- `client/src/app/+games/game-community.tokens.scss`：GameHub 语义颜色、圆角、阴影、间距、控件和动效令牌；只在这里定义基础视觉值。
- `client/src/sass/include/_gamehub-ui.scss`：全局 GameHub 作用域、PeerTube/Bootstrap/PrimeNG 兼容桥接和可复用 surface/control/state 基础类。
- `client/src/sass/application.scss`、`client/src/sass/bootstrap.scss`、`client/src/sass/primeng.scss`：加载基础层并让通用框架控件在 GameHub 页面消费同一套令牌；保留插件/遗留页面的非 GameHub 行为。
- `client/src/sass/include/_button-mixins.scss`、`client/src/sass/include/_form-mixins.scss`、`client/src/sass/include/_bootstrap-variables.scss`：公共按钮、输入、下拉和 Modal 的默认尺寸/焦点/圆角入口。
- `scripts/verify-gamehub-style.mjs`：只检查 GameHub 活动页面的令牌契约、允许的视觉特例和旧值残留；不扫描 `standalone` 或插件专用样式。
- `scripts/verify-gamehub-client.mjs`、`package.json`：将样式契约接入现有 GameHub 客户端验证命令。
- 认证/账户：`client/src/app/+login/login-modal.component.{html,scss}`、`client/src/app/+reset-password/reset-password.component.{html,scss}`、`client/src/app/+signup/shared/*.scss`、`client/src/app/shared/shared-forms/input-text.component.scss`、`client/src/app/game-account-{home,settings}.component.{ts,scss}`。
- 主体验：`client/src/app/header/*.scss`、`client/src/app/+games/games-home/**/*.scss`、`client/src/app/+games/game-card.component.scss`、`client/src/app/+games/game-play/**/*.scss`、`client/src/app/+games/game-author.component.scss`。
- 内容与工作台：`client/src/app/+games/game-{activity-feed,analytics-dashboard,article-detail,article-editor,articles,collections,collection-detail,comments,community-panel,creator,discuss,event-admin,event-detail,events,following,level-badge,library,manage,notifications,rankings,report-dialog,reservations,screenshots,share-dialog,tags-cloud,upload,watch-later}.component.scss`。
- 根页面和共享浮层：`client/src/app/game-about.component.scss`、`game-not-found.component.scss`、`client/src/app/modal/*.scss`、`client/src/app/hotkeys/hotkeys-cheat-sheet.component.scss`、必要的模板类名和内联样式。

## 执行约定

- 每个批次先增加或收紧静态契约，再修改样式；先运行契约看到失败，完成迁移后再运行同一命令确认通过。
- 所有标准颜色、圆角、阴影和控件尺寸使用 `var(--game-*)`；`#fff`/`#000`/`50%` 仅在文本反色、遮罩、圆形头像等明确语义中保留，并在契约 allowlist 中逐项说明。
- 不移动 Angular 业务逻辑，不修改 API、数据库、路由、权限、iframe sandbox/CSP 和弹窗生命周期。
- 不修改生成的 locale、dist、node_modules、既有 migration 或 `pnpm-lock.yaml`。

### Task 1: 建立样式契约与令牌扩展

**Files:**
- Create: `scripts/verify-gamehub-style.mjs`
- Modify: `scripts/verify-gamehub-client.mjs`
- Modify: `package.json`
- Modify: `client/src/app/+games/game-community.tokens.scss`

- [ ] **Step 1: 写样式契约的失败断言**

在 `scripts/verify-gamehub-style.mjs` 中读取 `client/src/app`、`client/src/sass` 的活动 SCSS，定义 `standardStyleFiles` 为所有 `+games` 页面、根级 `game-*` 页面、`header`、`+login`、`+reset-password`、`+signup/shared` 和 `shared/shared-forms/input-text.component.scss`，排除 `game-community.tokens.scss`、`+games/game-play/_runtime-frame.scss`、`+games/game-play/_related.scss`、`+games/game-screenshots.component.scss`、`+games/game-share-dialog.component.scss` 中的深色舞台/第三方品牌特例。加入以下断言：

```js
assert(tokens.includes('--game-control-height: 44px'), 'GameHub tokens must define the standard control height')
assert(tokens.includes('--game-radius-control:'), 'GameHub tokens must define the control radius')
assert(tokens.includes('--game-focus-ring:'), 'GameHub tokens must define the shared focus ring')
assert(tokens.includes('--game-space-grid:'), 'GameHub tokens must define the shared grid spacing')
assert(ui.includes('.game-ui-surface'), 'GameHub UI layer must expose a surface contract')
assert(ui.includes('.game-ui-control'), 'GameHub UI layer must expose a control contract')
assert(ui.includes('.game-ui-status'), 'GameHub UI layer must expose a state contract')
```

同时以正则扫描标准文件，禁止出现旧 Bootstrap dropdown shadow、`border-radius: 3px/4px`、未包在 token 定义中的颜色字面量和 `box-shadow` 字面量；allowlist 只接受 `var(--game-*)`、`50%` 圆形、反色文本令牌和明确列出的舞台/分享文件。输出每个违规文件和行号，不能只输出汇总计数。

- [ ] **Step 2: 运行契约确认 RED**

运行：`node scripts/verify-gamehub-style.mjs`

预期：命令失败，并列出缺少的 `--game-control-height`/`--game-focus-ring`/基础类以及现有页面中的硬编码颜色、旧阴影或旧圆角。

- [ ] **Step 3: 扩展 GameHub 令牌**

在 `game-community.tokens.scss` 的圆角、阴影和动效区补充控件/布局令牌，使用下列固定语义值，页面不得重复定义：

```scss
--game-control-height: 44px;
--game-control-height-sm: 38px;
--game-control-height-lg: 48px;
--game-control-padding-x: 1rem;
--game-radius-control: 8px;
--game-focus-ring: 0 0 0 3px var(--game-brand-glow);
--game-space-page: clamp(1rem, 2.4vw, 2rem);
--game-space-section: clamp(1.5rem, 3vw, 2.5rem);
--game-space-grid: 1rem;
--game-space-control: 0.75rem;
--game-info: #2563eb;
--game-info-soft: #eff6ff;
--game-info-border: #bfdbfe;
```

在同一文件加入 `.game-community-content` 的最大宽度和页面 gutter 计算，使首页、账户、关于、404 和社区页共享 `width: min(calc(100% - (var(--game-space-page) * 2)), var(--game-content-width))`。

- [ ] **Step 4: 接入契约命令**

将 `package.json` 增加 `"verify:gamehub-style": "node ./scripts/verify-gamehub-style.mjs"`，并让 `verify:gamehub-client` 在现有客户端契约通过后调用该脚本。脚本失败时必须让父命令返回非零。

- [ ] **Step 5: 运行契约确认 GREEN 并提交**

运行：`pnpm run verify:gamehub-style`

预期：仍可能因旧页面样式失败；完成本 Task 后只允许剩下下一批待迁移文件，契约本身和令牌断言通过。提交：

```powershell
git add scripts/verify-gamehub-style.mjs scripts/verify-gamehub-client.mjs package.json client/src/app/+games/game-community.tokens.scss
git commit -s -m 'test(ui): 建立 GameHub 样式统一契约'
```

### Task 2: 建立全局兼容桥接与基础控件

**Files:**
- Create: `client/src/sass/include/_gamehub-ui.scss`
- Modify: `client/src/sass/application.scss`
- Modify: `client/src/sass/bootstrap.scss`
- Modify: `client/src/sass/primeng.scss`
- Modify: `client/src/sass/include/_button-mixins.scss`
- Modify: `client/src/sass/include/_form-mixins.scss`
- Modify: `client/src/sass/include/_bootstrap-variables.scss`

- [ ] **Step 1: 在契约中锁定桥接入口**

在样式验证器中增加断言：`application.scss` 必须加载 `_gamehub-ui.scss`，`_gamehub-ui.scss` 必须包含 `.game-experience` 的 `--input-bg`、`--input-border-color`、`--input-border-radius`、`--primary` 映射以及 `.game-ui-surface`、`.game-ui-control`、`.game-ui-button-primary`、`.game-ui-button-secondary`、`.game-ui-button-danger`、`.game-ui-status`。

- [ ] **Step 2: 实现 GameHub 作用域和基础类**

在 `_gamehub-ui.scss` 中实现以下规则：GameHub 作用域把旧的 `--bg`/`--fg`/`--primary`/`--input-*` 变量映射到 `--game-*`；`.game-ui-surface` 使用 `--game-surface`、`--game-border`、`--game-radius-sm`、`--game-shadow`；`.game-ui-control` 统一 `min-height: var(--game-control-height)`、`border-radius: var(--game-radius-control)`、字体和 focus ring；三个按钮类分别使用 brand、透明边框和 danger 语义值；`.game-ui-status` 使用 grid/flex 对齐图标与文案，并根据 `.is-success/.is-warning/.is-danger/.is-info` 选择语义色。所有 `transition` 都使用令牌时序，并在 `prefers-reduced-motion` 中取消。

- [ ] **Step 3: 接入 Bootstrap/PeerTube/PrimeNG**

在 `application.scss` 全局引入 `_gamehub-ui.scss`，在 `bootstrap.scss`/`_bootstrap-variables.scss` 将 GameHub 作用域的输入、按钮、dropdown、modal 默认圆角/阴影改为 CSS 变量；在 `_button-mixins.scss` 和 `_form-mixins.scss` 保持原有非 GameHub 主题行为，只让 GameHub 作用域使用新的 control height、control radius 和 focus ring；在 `primeng.scss` 将 Toast、select、table header 等公共表面值映射到 GameHub surface/border/shadow 令牌。

- [ ] **Step 4: 运行编译与样式契约**

运行：`pnpm run verify:gamehub-style`、`pnpm run build:client:light`

预期：SCSS 成功编译；样式契约不再报告框架默认 dropdown shadow、旧基础控件圆角或未定义桥接变量。

- [ ] **Step 5: 提交基础层**

```powershell
git add client/src/sass client/src/app/+games/game-community.tokens.scss scripts/verify-gamehub-style.mjs
git commit -s -m 'style(ui): 统一 GameHub 全局控件基础层'
```

### Task 3: 统一认证、账户和共享表单

**Files:**
- Modify: `client/src/app/shared/shared-forms/input-text.component.scss`
- Modify: `client/src/app/+login/login-modal.component.scss`
- Modify: `client/src/app/+reset-password/reset-password.component.html`
- Modify: `client/src/app/+reset-password/reset-password.component.scss`
- Modify: `client/src/app/+signup/shared/signup-mascot.component.scss`
- Modify: `client/src/app/+signup/shared/signup-step-title.component.scss`
- Modify: `client/src/app/+signup/shared/signup-success.component.scss`
- Modify: `client/src/app/game-account-home.component.ts`
- Modify: `client/src/app/game-account-home.component.scss`
- Modify: `client/src/app/game-account-settings.component.scss`
- Modify: `client/src/app/+games/game-upload.component.scss`

- [ ] **Step 1: 先增加认证/账户契约**

在样式验证器中断言：重置密码页面包含 `game-community-page game-reset-password-page` 宿主；账户 skeleton 不再含 `style="...background:#eceff3..."`；共享 input 的 input、toggle button 和 error 使用 `--game-control-height`、`--game-radius-control`、`--game-focus-ring`；登录弹框和账户设置提交按钮使用相同的 control height/radius 令牌。

- [ ] **Step 2: 迁移共享输入组件**

将 `input-text.component.scss` 中 `pvar(--input-bg)`、`pvar(--bg)`、旧 opacity hover 和旧输入 mixin 的活动 GameHub 路径改为 `var(--game-surface-alt)`、`var(--game-border)`、`var(--game-radius-control)`、`var(--game-focus-ring)`；保留组件在非 GameHub 页面使用 PeerTube 变量的 fallback。toggle/copy 按钮的可点击高度固定为 `var(--game-control-height)`，错误文本使用 `var(--game-danger)`。

- [ ] **Step 3: 统一登录/注册/找回密码/重置密码**

复用 `.game-ui-control` 的高度、圆角、focus、hover、disabled 规则；删除登录弹框中对同一输入和按钮重复定义的固定 `44px`/`160ms`/环形 shadow；为 ng-bootstrap 找回密码模板添加 `game-auth-forgot-modal` 宿主类，使其 modal header/body/footer 与主登录弹框使用相同 surface 和间距；重置密码模板包在 GameHub 页面壳中；将 signup separator 的 `4px` 圆角迁移到 `--game-radius-control`。

- [ ] **Step 4: 清理账户页内联和局部旧值**

把账户主页 skeleton 的内联样式改为 `.game-account-profile-unavailable` 规则；账户主页、账户设置和投稿页的卡片、字段、错误提示、提交按钮统一使用 surface/control/state 令牌，保留页面专用布局而不改表单逻辑。

- [ ] **Step 5: 运行认证范围验证并提交**

运行：`pnpm run verify:gamehub-style`、`pnpm run build:client:light`

预期：认证/账户文件没有旧 `3px/4px` 控件圆角、内联颜色或固定 shadow；构建通过。提交：

```powershell
git add client/src/app/shared/shared-forms client/src/app/+login client/src/app/+reset-password client/src/app/+signup/shared client/src/app/game-account-home.component.* client/src/app/game-account-settings.component.scss client/src/app/+games/game-upload.component.scss scripts/verify-gamehub-style.mjs
git commit -s -m 'style(auth): 统一 GameHub 认证与账户表单'
```

### Task 4: 统一顶栏、首页、卡片、详情和作者空间

**Files:**
- Modify: `client/src/app/header/header.component.scss`
- Modify: `client/src/app/header/game-navigation.component.scss`
- Modify: `client/src/app/+games/games-home.component.scss`
- Modify: `client/src/app/+games/games-home/_layout.scss`
- Modify: `client/src/app/+games/games-home/_sections.scss`
- Modify: `client/src/app/+games/games-home/_discovery-nav.scss`
- Modify: `client/src/app/+games/games-home/_empty-states.scss`
- Modify: `client/src/app/+games/games-home/_responsive.scss`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.scss`
- Modify: `client/src/app/+games/games-home/game-section.component.ts`
- Modify: `client/src/app/+games/game-card.component.scss`
- Modify: `client/src/app/+games/game-author.component.scss`
- Modify: `client/src/app/+games/game-play.component.scss`
- Modify: `client/src/app/+games/game-play/_layout.scss`
- Modify: `client/src/app/+games/game-play/_game-info.scss`
- Modify: `client/src/app/+games/game-play/_author-card.scss`
- Modify: `client/src/app/+games/game-play/_related.scss`
- Modify: `client/src/app/+games/game-play/_responsive.scss`
- Modify: `client/src/app/+games/game-play/_runtime-frame.scss`

- [ ] **Step 1: 增加主体验令牌契约**

断言顶栏、导航、game card、首页 section、作者 hero 和详情内容卡的标准表面必须使用 `--game-radius-sm/md`、`--game-shadow-xs/shadow/lg`，普通按钮必须使用 `--game-radius-control`；断言首页/作者/详情共享 `--game-space-grid` 和 `--game-space-section`，不出现新的一次性 shadow 字面量。

- [ ] **Step 2: 收敛顶栏和导航**

将 header/navigation 中重复的 `rgb(255 255 255 / ...)`、硬编码 focus ring、局部 `160ms/180ms` 和按钮圆角改为 `--game-surface`、`--game-brand-glow`、`--game-dur*`、`--game-radius-*`；保留 header 的透明/滚动态，但两种状态使用同一 surface/shadow 级别。统一投稿、登录、头像、通知、收藏、历史入口的 control height 和 icon button focus。

- [ ] **Step 3: 收敛首页与卡片**

让 section heading、发现导航、空状态、加载 skeleton、featured carousel 和 game card 使用同一页面 gutter、grid gap、surface border/shadow/radius；封面遮罩仍可使用 `--game-overlay`，卡片 hover 仍保持上移和缩放，但动效时长/焦点/减少动态效果全部引用令牌。清理 `#34d399`、`#514c96` 等基础装饰色，改用 brand/success/accent 语义值。

- [ ] **Step 4: 收敛详情、作者和舞台边界**

统一详情标题、信息卡、作者卡、相关推荐的浅色表面；游戏 iframe 内的深色舞台仅保留暗色背景、控制条和错误卡特例，使用明确的 stage token 或注释，不把运行态强行改成白色。作者 hero 的深色封面遮罩使用 `--game-cover-fallback*`/`--game-overlay`，统计条和关注按钮使用通用 surface/control。

- [ ] **Step 5: 运行页面范围契约并提交**

运行：`pnpm run verify:gamehub-style`、`pnpm run build:client:light`

预期：顶栏/首页/卡片/详情/作者范围无未说明的硬编码基础色、旧 shadow 或控件圆角；五列桌面网格、移动端布局和 reduced-motion 现有契约保持通过。提交：

```powershell
git add client/src/app/header client/src/app/+games/games-home client/src/app/+games/game-card.component.scss client/src/app/+games/game-author.component.scss client/src/app/+games/game-play scripts/verify-gamehub-style.mjs
git commit -s -m 'style(games): 统一 GameHub 主体验页面样式'
```

### Task 5: 统一社区、内容、创作、管理和根页面

**Files:**
- Modify: `client/src/app/+games/game-activity-feed.component.scss`
- Modify: `client/src/app/+games/game-analytics-dashboard.component.scss`
- Modify: `client/src/app/+games/game-article-detail.component.scss`
- Modify: `client/src/app/+games/game-article-editor.component.scss`
- Modify: `client/src/app/+games/game-articles.component.scss`
- Modify: `client/src/app/+games/game-collections.component.scss`
- Modify: `client/src/app/+games/game-collection-detail.component.scss`
- Modify: `client/src/app/+games/game-comments.component.scss`
- Modify: `client/src/app/+games/game-community-panel.component.scss`
- Modify: `client/src/app/+games/game-creator.component.scss`
- Modify: `client/src/app/+games/game-discuss.component.scss`
- Modify: `client/src/app/+games/game-event-admin.component.scss`
- Modify: `client/src/app/+games/game-event-detail.component.scss`
- Modify: `client/src/app/+games/game-events.component.scss`
- Modify: `client/src/app/+games/game-following.component.scss`
- Modify: `client/src/app/+games/game-level-badge.component.scss`
- Modify: `client/src/app/+games/game-library.component.scss`
- Modify: `client/src/app/+games/game-manage.component.scss`
- Modify: `client/src/app/+games/game-notifications.component.scss`
- Modify: `client/src/app/+games/game-rankings.component.scss`
- Modify: `client/src/app/+games/game-report-dialog.component.scss`
- Modify: `client/src/app/+games/game-reservations.component.scss`
- Modify: `client/src/app/+games/game-tags-cloud.component.scss`
- Modify: `client/src/app/+games/game-upload.component.scss`
- Modify: `client/src/app/+games/game-watch-later.component.scss`
- Modify: `client/src/app/game-about.component.scss`
- Modify: `client/src/app/game-not-found.component.scss`
- Modify: `client/src/app/modal/confirm.component.scss`
- Modify: `client/src/app/modal/custom-modal.component.scss`
- Modify: `client/src/app/modal/instance-config-warning-modal.component.scss`
- Modify: `client/src/app/modal/account-setup-warning-modal.component.scss`
- Modify: `client/src/app/hotkeys/hotkeys-cheat-sheet.component.scss`

- [ ] **Step 1: 增加社区/工作台契约**

在验证器中断言活动、评论、讨论、活动、文章、收藏、通知、预约、排行榜、分析和管理页面的标准卡片都使用 `--game-surface`/`--game-border`/`--game-radius-*`；状态色只允许 `--game-brand`、`--game-info`、`--game-success`、`--game-warning`、`--game-danger`、`--game-accent` 及其 soft/border 令牌；分享按钮文件中的微博/QQ/X 颜色加入显式第三方 allowlist。

- [ ] **Step 2: 迁移重复卡片和状态块**

把各页的卡片、表格、筛选栏、空状态、加载 skeleton、错误反馈、成功提示和删除确认统一到 surface/state 基础契约；统一卡片 header、section gap、按钮高度、标签圆角和 hover/focus。保留社区评论的 B 站式信息层级，但仅保留布局语义，不保留独立的基础颜色/阴影体系。

- [ ] **Step 3: 迁移语义状态色**

将活动/活动详情/预约/通知/排行中的 `#3b82f6`、`#ef4444`、`#f59e0b`、`#166534`、`#92400e`、`#991b1b`、`#0369a1`、`#dcfce7`、`#fee2e2`、`#fef3c7` 等成组值分别替换为 info/danger/warning/success 令牌。将文章删除、评论删除、管理失败和表单错误全部使用 danger 语义，不改变文案或业务处理。

- [ ] **Step 4: 清理根页面、Modal 和热键残留**

关于页、404、通用 Modal、确认框和热键弹层使用同一浮层 surface、control radius、shadow-popover、focus ring 和页面 gutter；热键键帽的内阴影属于键帽材质特例，改为令牌或加注释，不影响键盘交互。

- [ ] **Step 5: 运行契约、构建并提交**

运行：`pnpm run verify:gamehub-style`、`pnpm run verify:gamehub-client`、`pnpm run build:client:light`

预期：活动 SPA 标准样式文件只剩契约允许的舞台/分享/圆形语义特例；所有页面构建通过。提交：

```powershell
git add client/src/app/+games client/src/app/game-about.component.scss client/src/app/game-not-found.component.scss client/src/app/modal client/src/app/hotkeys scripts/verify-gamehub-style.mjs
git commit -s -m 'style(ui): 清理 GameHub 页面旧样式残留'
```

### Task 6: 全量验证、真实浏览器回归和交付收尾

**Files:**
- Read: `scripts/self-test-gamehub.ps1`
- Read: `scripts/verify-gamehub-client.mjs`
- Read: `client/src/app/app.component.html`
- Read: `client/src/app/header/header.component.html`
- Read: `client/src/app/+games/games-home.component.html`
- Read: `client/src/app/+games/game-play.component.html`
- Modify if user-visible summary is required: `docs/releases/release-notes.md`, `README.md`

- [ ] **Step 1: 运行差异和样式门禁**

运行：`git diff --check`、`pnpm run verify:gamehub-style`、`pnpm run verify:gamehub-client`、`pnpm run build:client:light`、`pnpm run build:server`、`pnpm run lint`

预期：全部命令退出码为 0；只允许既有构建预算/动态导入 warning，不允许新增 SCSS、TypeScript、模板或 OpenAPI 错误。

- [ ] **Step 2: 启动 develop 构建并验证健康检查**

按根 `AGENTS.md` 使用开发依赖编排启动 PostgreSQL/Redis，构建 server/client 后从 develop 工作区启动服务；运行 `Invoke-WebRequest http://127.0.0.1:9000/api/v1/ping`，并请求 SPA 入口、首页懒加载脚本和一个游戏 API。若本轮启动了服务，收尾时确认其来源并停止或保留为明确可运行状态。

- [ ] **Step 3: 真实浏览器页面回归**

用 Codex 内置浏览器优先；若不可用，使用已安装 Chrome/Playwright 并记录替代原因。至少验证：

1. 未登录首页：顶栏、发现导航、featured、卡片、空/加载状态、桌面与移动宽度无横向溢出；
2. 搜索/分类：筛选/换一换/加载更多按钮的统一高度、focus、disabled 和 hover；
3. 游戏详情：标题/作者/社区卡、iframe 舞台、错误卡、相关推荐和分享按钮；
4. 登录弹框：输入、密码显示切换、错误态、注册切换、找回密码弹层和关闭按钮；
5. 账户设置：表单、错误提示、提交禁用/成功 Toast；
6. 社区或活动详情、投稿/分析页：卡片、标签、状态反馈和主要操作；
7. 设置 `prefers-reduced-motion` 并确认页面不会继续播放关键 hover/carousel 动效。

- [ ] **Step 4: 运行权威 GameHub 门禁**

运行：`pnpm run self-test:gamehub`

预期：server/client 构建、lint、本次 client 文件检查、源码/构建 bundle 检查、`/api/v1/ping`、SPA 入口和懒加载脚本全部通过；失败时保留日志并回到对应任务修复，不能用 `-SkipBuild/-SkipLint/-SkipLive` 作为最终结果。

- [ ] **Step 5: 判断并更新发布说明**

按 `readme-release-updater` 检查本次 diff。由于样式统一会改变用户可见页面表现，应在同一日期已有标题下补充用户视角摘要，并将 README `## 最新更新` 刷新为最新日期块；不得写入文件路径、测试信息或内部重构细节。

- [ ] **Step 6: 提交最终验证结果**

运行：`git status --short --branch`、`git diff --check`、`git branch --show-current`、`git log -1 --oneline --decorate`、`git worktree list --porcelain`。

确认只包含预期文件后提交最终必要改动；随后按项目规则把 `codex/ui-style-unification` 合并到 `develop`，`git push origin develop`，执行 `git fetch origin --prune` 并比较：

```powershell
$localDevelop = git rev-parse develop
$remoteDevelop = git rev-parse origin/develop
if ($localDevelop -ne $remoteDevelop) { throw 'develop 尚未与 origin/develop 同步' }
git merge-base --is-ancestor codex/ui-style-unification develop
```

确认当前任务 worktree 已移除、`Test-Path D:\Github\_worktrees\GameHub\ui-style-unification` 为 `False`，只清理本任务 worktree，不触碰其他并行 worktree。

## 计划自审

- 设计文档的令牌、基础控件、逐类迁移、响应式/无障碍、运行时边界和验收标准分别由 Task 1–5 覆盖；Task 6 覆盖构建、API 健康检查、真实浏览器和主分支收尾。
- 占位标记和未定义的函数/类型均已排除；每个代码批次都给出具体文件、命令和预期结果。
- 令牌源、全局基础层和页面局部布局职责分离；桥接只在 GameHub 作用域生效，避免破坏插件/遗留页面。
