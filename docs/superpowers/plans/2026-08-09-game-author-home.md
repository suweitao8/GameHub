# GameHub UP 主主页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/games/author/:accountId` 改造成参考 UP 主主页信息层级的 GameHub 作者主页，同时保持现有真实数据和路由行为。

**Architecture:** 修改作者页模板/样式、作者 API 共享模型与响应映射、作者数据请求版本参数和 GameHub 静态契约。主页直接消费现有作者游戏数组，排序继续通过 query params 导航，CSS 使用现有 token 和响应式断点完成全宽网格布局。

**Tech Stack:** Angular standalone component、SCSS、pnpm、真实浏览器 QA。

---

### 任务 1：先建立作者主页结构回归断言

**Files:**

- Modify: `scripts/verify-gamehub-client.mjs:160-168`
- Test input: `client/src/app/+games/game-author.component.html` and `client/src/app/+games/game-author.component.scss`

- [x] **Step 1: 写失败断言**

在作者页契约中要求 `author-hero`、`author-hero-banner`、`author-navigation-row`、`author-home-tab`、`author-stats-bar`、`author-main`、`author-filter-row`、全部游戏网格和 `@media (max-width: 640px)` 存在，并要求动态/投稿/合集、置顶和侧栏结构不存在。

- [x] **Step 2: 运行断言确认失败**

运行：`node scripts/verify-gamehub-client.mjs`

结果：新增作者单一主页契约按预期失败，随后完成模板和样式实现。

### 任务 2：实现作者主页模板层级

**Files:**

- Modify: `client/src/app/+games/game-author.component.html:24-125`

- [x] **Step 1: 重排 hero 和统计条**

保留现有 `author()`、`isOwnAuthor()`、`toggleFollow()` 和 `formatNumber()` 绑定，将头部容器改为 `author-hero`，在 hero 内增加 `author-hero-banner`、作者身份、轻量标签和关注区域；统计条绑定关注数、粉丝数、获赞数和游玩数。

- [x] **Step 2: 收敛主页内容区**

保留三个 `selectSort()` 按钮、关注交互和游戏卡片，移除 `selectTab()`、动态列表、合集列表、置顶作品路由和右侧资料/创作数据字段，不新增用户可见的伪造数据。

- [x] **Step 3: 运行作者模板 lint**

运行：`cd client; npx eslint src/app/+games/game-author.component.html`

预期：退出码 0。

### 任务 3：实现参考图风格的作者页视觉和响应式布局

**Files:**

- Modify: `client/src/app/+games/game-author.component.scss:1-330`

- [x] **Step 1: 实现 hero、统计和主页标识视觉**

使用浅色横幅渐变、底部头像、白色统计条、品牌色主页标识和现有 `--game-*` token，保持关注按钮的默认、已关注、禁用/处理中和错误反馈样式。

- [x] **Step 2: 实现全宽卡片网格**

桌面使用全宽主列和五列游戏网格；移除置顶卡、资料卡和创作数据卡，保留排序按钮和真实游戏卡片。

- [x] **Step 3: 实现 1050px/850px/640px 响应式布局**

1050px 以下缩减为四列，850px 以下改为两列，640px 以下 hero 改为纵向、主页统计栏在内部横向滚动，并确保 `document.documentElement.scrollWidth <= innerWidth`。

- [x] **Step 4: 运行相关 SCSS lint**

运行：`cd client; npx stylelint src/app/+games/game-author.component.scss`

预期：退出码 0。

### 任务 4：构建并进行真实浏览器验证

**Files:**

- Verify: `client/src/app/+games/game-author.component.html`
- Verify: `client/src/app/+games/game-author.component.scss`

- [ ] **Step 1: 构建客户端**

运行：`pnpm run build:client:light` 和 `pnpm run build:client`；若 Windows 的 `bash` 被 WSL shim 接管，则用 `D:\Apps\Git\bin\bash.exe ./scripts/build/client.sh` 执行同一生产脚本。

- [ ] **Step 2: 检查接口**

请求 `http://127.0.0.1:9000/api/v1/ping` 和 `http://127.0.0.1:9000/api/v1/games/author/2?sort=latest`，确认返回 200。

- [ ] **Step 3: 检查三种视口**

在 `/games/author/2` 使用 1440px、768px、375px 视口，确认 hero、主页统计、全部游戏网格存在，页面无横向溢出；确认动态/投稿/合集、置顶和侧栏不存在，点击排序按钮确认 URL 与 active 状态更新。

- [ ] **Step 4: 运行完整门禁并记录基线失败**

运行：`pnpm run self-test:gamehub`。记录本次作者页契约是否通过；若其余 GameHub 详情/讨论契约仍为 develop 基线失败，不修改无关模块。

- [ ] **Step 5: 收尾检查**

运行：`git diff --check`、`git status --short`，确认只包含作者页、静态契约、设计和计划文件以及之前已存在的导航栏改动。

### 本轮增量：同排作者统计

- 作者统计改为关注数、粉丝数、获赞数、游玩数，并与四个作者标签共用 `.author-navigation-row`。
- `GET /api/v1/games/author/:accountId` 返回 `account.followingCount`；前端作者请求使用 `authorStatsVersion=2`，避免浏览器复用旧响应形状。
- 桌面端统计组靠右；窄屏保持同一行并在栏内滚动，页面本身不得横向溢出。

### 本轮增量：单一主页全量游戏

- 移除动态、投稿、合集标签及其面板，保留单一“主页”标识。
- 移除置顶重复卡和右侧资料/创作数据栏，主页直接展示作者全部开发的游戏。
- 旧 `tab` 查询参数不再驱动面板切换，排序参数和作者统计接口保持不变。
