# GameHub Logo 蓝品牌视觉重构 Implementation Plan

> **执行记录：** 本计划已在独立 worktree 完成；复选框记录实际完成状态，验证证据保留在 Task 6。

**Goal:** 将 GameHub 全站页面框架重构为围绕 Logo 蓝 `#00aeec` 的清爽游戏平台视觉，同时保留现有功能、路由、运行时和内容色彩。

**Architecture:** 以 `client/src/app/+games/game-community.tokens.scss` 作为颜色和层级单一来源，通过 `client/src/sass/include/_gamehub-ui.scss` 向旧组件契约提供兼容变量；页面级 SCSS 只消费令牌，不引入新的主题依赖。静态验证脚本负责锁定关键品牌契约，内置浏览器负责真实页面验收。

**Tech Stack:** Angular、SCSS、TypeScript/Node 验证脚本、pnpm、ZCode 内置浏览器。

---

## Task 1: 固化设计契约并建立基线

**Files:**
- Modify: `scripts/verify-gamehub-style.mjs`
- Modify: `scripts/verify-gamehub-client.mjs`
- Read: `client/src/assets/images/gamehub-logo.svg`
- Read: `client/src/app/+games/game-community.tokens.scss`

- [x] 在独立 worktree 确认分支、基线提交、工作区和现有 worktree 状态。
- [x] 读取现有验证脚本，沿用其检查方式；增加对 Logo 蓝、冰蓝画布、深蓝标题文字、品牌对比色和主按钮契约的断言，不删除当前已有断言。
- [x] 让新增断言先针对目标状态失败，记录 RED 输出，避免只改色值而遗漏页面契约。
- [x] 检查设计稿与计划稿内容完整，没有范围外的 API/依赖变更。

验证命令：

```powershell
node scripts/verify-gamehub-client.mjs
node scripts/verify-gamehub-style.mjs
```

## Task 2: 更新共享令牌、全局桥接和导航

**Files:**
- Modify: `client/src/app/+games/game-community.tokens.scss`
- Modify: `client/src/sass/include/_gamehub-ui.scss`
- Modify: `client/src/app/header/header.component.scss`
- Modify: `client/src/app/header/game-navigation.component.scss`

- [x] 将页面背景、表面、文字、边框令牌更新为设计稿中的冰蓝/白色/深蓝值；保留危险、警告、成功等语义色。
- [x] 将默认主 CTA、提交、登录和创建等主要行动从粉色 accent 切换到 `--game-brand`，粉色只保留明确的热门/提醒语义。
- [x] 统一全局旧类（按钮、输入框、卡片、弹层、Toast、页脚）的颜色、边框、focus-visible 和 disabled 契约。
- [x] 保证搜索输入保持单层边框和单层焦点环，修复搜索框叠加问题不回归。
- [x] 运行 Task 1 的静态检查，确认新增断言 GREEN。

验证命令：

```powershell
node scripts/verify-gamehub-client.mjs
node scripts/verify-gamehub-style.mjs
pnpm exec tsc -b client/tsconfig.json --pretty false
```

## Task 3: 重构首页、卡片、详情和作者页面

**Files:**
- Modify: `client/src/app/+games/games-home/_sections.scss`
- Modify: `client/src/app/+games/games-home/_discovery-nav.scss`
- Modify: `client/src/app/+games/games-home/game-section.component.ts`
- Modify: `client/src/app/+games/game-card.component.scss`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.scss`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.html`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.ts`
- Modify: `client/src/app/+games/game-play/_layout.scss`
- Modify: `client/src/app/+games/game-play/_runtime-frame.scss`
- Modify: `client/src/app/+games/game-author.component.scss`
- Modify: `client/src/app/+games/game-creator.component.scss`

- [x] 将首页 canvas、频道、标题行、筛选、推荐区和空状态改为冰蓝画布/白色内容层/品牌浅底。
- [x] 保留封面图和游戏内容的多彩颜色，仅统一卡片外框、信息层、统计控件和主要操作。
- [x] 将详情、作者、相关游戏和游玩壳层接入共享表面、文字、边框和品牌行动令牌；不修改 iframe 内部样式。
- [x] 保持当前首页“换一批”、频道 pill、轮播、卡片链接和响应式行为。
- [x] 在静态验证中锁定首页/详情至少一个 surface 和 primary-action 令牌引用，避免后续页面重新引入硬编码主色。
- [x] 运行服务端构建与客户端轻量构建，确认 SCSS 编译和 Angular 模板没有受到影响。

验证命令：

```powershell
pnpm run build:server
pnpm run build:client:light
node scripts/verify-gamehub-client.mjs
```

## Task 4: 重构社区、认证、账号和工作台

**Files:**
- Modify: `client/src/app/+games/game-upload.component.scss`
- Modify: `client/src/app/game-account-settings.component.scss`
- Modify: `client/src/app/+signup/shared/signup-mascot.component.scss`
- Modify: `client/src/app/+signup/shared/signup-step-title.component.scss`
- Modify: `client/src/app/game-about.component.scss`
- Modify: `client/src/sass/include/_gamehub-ui.scss`

- [x] 先用 `rg` 对 `--game-accent`、旧灰紫背景和高优先级 hard-coded 主按钮颜色做清单，再按语义逐项迁移，避免盲目全局替换。
- [x] 社区、作者、个人库、通知、上传和创建操作使用品牌蓝作为主要行动，错误/警告/成功保留语义色。
- [x] 账号、登录、注册、重置密码和共享表单使用统一的输入、focus、error、loading、disabled 和空状态。
- [x] 认证/账号的窄屏布局保持可用，控件触控区域至少 44px，不引入横向滚动。
- [x] 对遗留上游页面只做 GameHub 壳层和控件令牌迁移；不改变认证逻辑或 API。

验证命令：

```powershell
pnpm run build:client
pnpm run lint
node scripts/verify-gamehub-client.mjs
node scripts/verify-gamehub-style.mjs
```

## Task 5: 使用内置浏览器做真实页面验收

- [x] 用 Node 22.23.2（满足 Angular 对 Node 22.22.3+ 的要求）从本 worktree 启动客户端开发服务器到 `127.0.0.1:3001`，不要占用 8080；已完成冻结依赖安装。
- [x] 使用 ZCode 内置浏览器验证 `/games`、真实游戏详情页、社区/个人库/作者鉴权、上传鉴权、账号/设置、登录弹层、about/未知路由等可达页面。
- [x] 截图并检查桌面宽度和 375×800 窄屏：品牌蓝层级、搜索单层边框、导航、卡片、按钮、弹层、表单 focus、空/错误状态、无横向溢出。
- [x] 验证 `prefers-reduced-motion` 下没有必须依赖动画的状态；确认游戏 iframe 和封面内容仍可正常显示。
- [x] 发现问题时回到对应页面 SCSS 做最小修复，再重复受影响页面的浏览器验收。
- [x] 停止本 worktree 启动的服务，避免留下后台进程。

## Task 6: 完整门禁、提交、合并与收尾

- [x] 读取并执行 `readme-release-updater`，根据用户可见的视觉重构更新 `docs/releases/release-notes.md` 和 README 的“最新更新”。
- [x] 读取并执行 `verification-before-completion` 与 `requesting-code-review`；先跑验证再声称完成。
- [x] 执行 `git diff --check`，确认状态只包含本任务预期文件。
- [x] 使用 Node 22.23.2 执行完整 `pnpm run self-test:gamehub`，不使用 skip 参数。
- [x] 在 task worktree 创建签名提交：`git commit -s -m "重构 GameHub Logo 蓝品牌视觉"`。
- [x] 回到 `D:\Github\GameHub`，确认没有其他会话改动后，将 `codex/blue-brand-redesign` 合并到 `develop`，推送 `origin/develop`。
- [x] 执行最终状态检查、`git fetch origin --prune`、local/remote SHA 比对、task branch ancestor 检查，删除本任务 worktree 并运行 `git worktree prune`。
- [x] 最终回复说明改动范围、验证证据、提交/远程状态；若任何门禁或清理未通过，明确说明具体阻塞项。

## Plan Review

- 设计稿中的蓝色令牌、页面层级、控件状态、响应式和范围边界均有对应任务。
- 计划不修改 API、数据库、路由、运行时 iframe、生成文件或依赖。
- 每个实现阶段都有可执行的静态、编译、lint 或浏览器验证。
- 任务按共享契约到页面应用再到真实验收排序；页面级迁移之前先锁定令牌契约。
