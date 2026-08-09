# 游戏详情页界面优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 GameHub 游戏 API 的前提下，优化游戏详情页的信息层级、试玩状态反馈、互动操作和响应式表现。

**Architecture:** 继续使用现有 Angular standalone component、signals 和 SCSS partials。把 iframe 错误从页面级加载错误中拆出为独立 signal，在模板内渲染局部恢复卡片；视觉调整只作用于 `game-play-page`，并用现有 `game-*` token。

**Tech Stack:** Angular 19 standalone components、TypeScript signals、SCSS、ESLint、Stylelint、GameHub source-contract verifier、PowerShell self-test、内置浏览器。

---

### Task 1: 建立失败优先的详情页契约测试

**Files:**
- Modify: `scripts/verify-gamehub-client.mjs`（游戏详情页契约段）
- Test: `scripts/verify-gamehub-client.mjs`

- [ ] **Step 1: 写出新行为的断言**

在现有 `playHtml` 读取和 `playTs` 读取附近加入以下断言；断言要求模板包含独立的 `frameError` 分支、重试按钮和 `aria-live`，TypeScript 包含独立 signal、错误清理和不再把 iframe 错误写入页面级 `loadingError`：

```js
const playScss = read('client/src/app/+games/game-play.component.scss')
const playLayoutScss = read('client/src/app/+games/game-play/_layout.scss')
const playRuntimeScss = read('client/src/app/+games/game-play/_runtime-frame.scss')
const playInfoScss = read('client/src/app/+games/game-play/_game-info.scss')
assert(playHtml.includes('frameError()'), 'game-play must render an iframe-specific error state')
assert(playHtml.includes('重新连接'), 'game-play iframe error state must expose a reconnect action')
assert(playHtml.includes('aria-live="polite"'), 'game-play runtime status must be announced politely')
assert(playTs.includes('readonly frameError = signal(false)'), 'game-play must own an iframe-specific error signal')
assert(playTs.includes('this.frameError.set(false)'), 'game-play must clear the iframe error before retrying')
assert(!playTs.includes('onFrameError () { this.frameLoading.set(false); this.loadingError.set(true) }'), 'iframe errors must not replace the whole game page')
assert(playLayoutScss.includes('--game-detail-surface'), 'game-play layout must define a detail surface token')
assert(playRuntimeScss.includes('.frame-error-card'), 'game runtime must style a local error card')
assert(playRuntimeScss.includes('prefers-reduced-motion'), 'game runtime motion must respect reduced-motion preferences')
assert(playInfoScss.includes('.game-description-tab'), 'game info tabs must keep an explicit visual contract')
```

- [ ] **Step 2: 运行断言确认旧代码失败**

Run: `node scripts/verify-gamehub-client.mjs`

Expected: FAIL with `game-play must render an iframe-specific error state` (the baseline has no `frameError` signal/branch yet).

- [ ] **Step 3: 提交测试契约**

```powershell
git add scripts/verify-gamehub-client.mjs
git commit -m "测试: 增加游戏详情页状态契约"
```

### Task 2: 拆分 iframe 错误状态并补齐模板语义

**Files:**
- Modify: `client/src/app/+games/game-play.component.ts`
- Modify: `client/src/app/+games/game-play.component.html`

- [ ] **Step 1: 添加独立 iframe 错误 signal**

在现有 `frameLoading` signal 后加入 `readonly frameError = signal(false)`，并在 `loadGame`、`reloadGame` 中清理它。

- [ ] **Step 2: 修改 iframe 事件处理**

让 `onFrameError` 只设置 `frameLoading=false`、`frameError=true` 和 `gameStarted=false`；让 `onFrameLoaded` 清理 `frameError` 后再同步音量。`reloadGame` 先递增 reload key、设置 `frameLoading=true`、清理 `frameError`，再更新安全 URL。

- [ ] **Step 3: 把错误分支放在舞台内部**

在 `game-stage` 内按以下顺序渲染：加载层、iframe、局部错误卡片、开始按钮、控制条。错误卡片包含 `role="alert"`、标题“试玩暂时不可用”、说明文字和调用 `reloadGame()` 的“重新连接”按钮。开始按钮仅在 `!gameStarted() && !frameLoading() && !frameError()` 时渲染。

- [ ] **Step 4: 为状态和 tab 增加语义关联**

给播放控制状态增加 `aria-live="polite"`；给简介/操作两个 tab 增加 `aria-controls="game-description-panel"`，给内容容器增加 `id="game-description-panel"` 与 `role="tabpanel"`。

- [ ] **Step 5: 运行契约确认仍为失败或只剩样式断言**

Run: `node scripts/verify-gamehub-client.mjs`

Expected: 输出中不再出现 iframe 状态相关失败；如果样式尚未修改，只剩 `detail surface token`、`frame-error-card` 或 `prefers-reduced-motion` 相关失败。

### Task 3: 实现 B 方案的页面表面与试玩视觉层级

**Files:**
- Modify: `client/src/app/+games/game-play/_layout.scss`
- Modify: `client/src/app/+games/game-play/_runtime-frame.scss`

- [ ] **Step 1: 添加详情页 token 和表面层级**

在 `.game-play-page` 中增加以下 token，并让详情页使用 `var(--game-detail-surface)`、`var(--game-detail-surface-muted)`、`var(--game-detail-shadow)`，不修改其它游戏页面的全局配色：

```scss
--game-detail-surface: #fff;
--game-detail-surface-muted: #f6f8fa;
--game-detail-shadow: 0 8px 24px rgb(25 30 40 / 6%);
```

为标题区、互动面板和推荐卡片统一边框、圆角和 padding，网格间距继续使用 `var(--game-detail-gap)`。

- [ ] **Step 2: 优化试玩舞台错误卡片**

增加 `.frame-error-card` 及其标题、说明、按钮样式：卡片居中、颜色对比满足 WCAG AA、按钮最小高度 44px，且不遮挡舞台底部控制条。为加载和消息动画添加 `@media (prefers-reduced-motion: reduce)`，将动画时长置为 `1ms` 并禁用 transform。

- [ ] **Step 3: 优化控制条的可见性和移动端触控尺寸**

保持 hover/focus 可见逻辑，同时让控制条在触摸窄屏上常驻；按钮宽高至少 44px，状态文字在 600px 以下允许缩短或换行，音量 range 不因 hover 才能使用。

- [ ] **Step 4: 运行 SCSS 检查**

Run: `pnpm --dir client exec stylelint src/app/+games/game-play.component.scss src/app/+games/game-play/_layout.scss src/app/+games/game-play/_runtime-frame.scss src/app/+games/game-play/_game-info.scss`

Expected: exit code 0。

### Task 4: 优化互动信息区与侧栏密度

**Files:**
- Modify: `client/src/app/+games/game-play/_game-info.scss`
- Modify: `client/src/app/+games/game-play/_related.scss`
- Modify: `client/src/app/+games/game-play/_responsive.scss`

- [ ] **Step 1: 统一互动操作和 tab 状态**

让操作按钮有默认、hover、focus-visible、active、disabled 五种状态；异步禁用态保留当前计数但降低透明度。tab 使用清晰的底部 active indicator，描述面板保留可读的空状态。

- [ ] **Step 2: 降低侧栏视觉噪音**

让讨论群成为唯一的高密度卡片，相关推荐使用更轻的 border/background；统一 related row 的 thumbnail、标题两行截断和统计行，避免推荐卡片夺取主试玩区焦点。

- [ ] **Step 3: 修正关键断点**

在 980px 以下使用单列并把侧栏放到主内容后；在 600px 以下将页面宽度设为 `calc(100% - 24px)`，保证标题、开发者操作、控制条和错误卡片不横向溢出。所有可点击控件保持至少 44px 高度。

- [ ] **Step 4: 运行契约与变更文件 lint**

Run: `node scripts/verify-gamehub-client.mjs`

Expected: `verify-gamehub-client OK`。

Run: `pnpm --dir client exec eslint src/app/+games/game-play.component.ts src/app/+games/game-community-panel.component.ts`

Expected: exit code 0。

### Task 5: 构建与真实浏览器验证

**Files:**
- No new source files; inspect generated output only.

- [ ] **Step 1: 构建轻量客户端**

Run: `pnpm run build:client:light`

Expected: client build exits 0 and writes `client/dist/browser/en-US/index.html`。

- [ ] **Step 2: 运行 GameHub source/build contract**

Run: `pnpm run verify:gamehub-client`

Expected: `verify-gamehub-client OK`。

- [ ] **Step 3: 运行完整交付门禁**

Run: `pnpm run self-test:gamehub`

Expected: `SELF-TEST PASS: build, static assets, and runtime entry checks passed.`

- [ ] **Step 4: 在浏览器验证关键路径**

打开 `http://127.0.0.1:9000/games/af3f96ab-0481-4fa8-b79b-41a6e29bf7ab`，分别检查 1440px、900px、390px：标题和开发者信息可读；iframe 失败时只出现局部错误卡片；点击“重新连接”重新进入加载态；开始游戏、音量和全屏按钮可见且可聚焦；简介/操作 tab 能切换；评论和讨论群输入在窄屏不溢出；控制台没有本次改动产生的错误。

- [ ] **Step 5: 完成差异与交付检查**

Run:

```powershell
git diff --check
git status --short
git log -1 --oneline --decorate
```

Expected: only planned client/source-contract files are modified, no whitespace errors, and the task branch contains the implementation commit.
