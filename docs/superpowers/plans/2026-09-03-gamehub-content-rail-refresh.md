# GameHub 内容广场第二轮视觉重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GameHub 从稀疏的浅色目录页推进为有推荐主视觉、海报式占位卡和紧凑内容轨道的 B 站启发式游戏发现广场。

**Architecture:** 保持现有 Angular 组件、路由和推荐数据流不变，以 `game-community.tokens.scss` 作为唯一视觉令牌源；由 header/search、home featured/card、以及榜单/标签/动态的页面 SCSS 分别负责平台壳、内容卡和公共内容页。模板只补充无封面状态需要的语义信息，不引入新的 UI 依赖。

**Tech Stack:** Angular standalone components, native SCSS, existing GameHub static contracts, in-app browser, PowerShell.

---

### Task 1: 扩展视觉回归契约

**Files:**
- Modify: `scripts/verify-gamehub-style.mjs`
- Modify: `scripts/verify-gamehub-client.mjs`
- Test: the two verifier scripts

- [ ] **Step 1: 增加新设计的 RED 断言**

在现有契约读取 `game-card.component.html`、`featured-carousel.component.html` 和对应 SCSS 的位置增加以下断言：普通封面占位必须包含 `cover-poster-kicker` 和 `cover-poster-index`，推荐主卡必须包含 `featured-cover-copy`，精选侧栏必须使用 `grid-template-columns: repeat(2, minmax(0, 1fr));`，搜索字段必须使用 `--game-search-surface`。

```js
assert(cardTemplate.includes('cover-poster-kicker') && cardTemplate.includes('cover-poster-index'), 'game cards must expose semantic poster fallback labels')
assert(featuredTemplate.includes('featured-cover-copy'), 'featured carousel must expose an in-cover title hierarchy')
assert(featuredStyles.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'featured side cards must stay readable in a two-column rail')
assert(navigation.includes('background: var(--game-search-surface);'), 'search input must use the shared content-platform field surface')
```

- [ ] **Step 2: 运行契约确认 RED**

Run `pnpm run verify:gamehub-style` and `pnpm run verify:gamehub-client` from the worktree. Expected: failure仅来自上述新断言，不修改现有测试基线。

- [ ] **Step 3: 提交测试检查点**

```powershell
git add scripts/verify-gamehub-style.mjs scripts/verify-gamehub-client.mjs
git commit -s -m "test: define content rail visual contracts"
```

### Task 2: 更新平台令牌和顶栏搜索

**Files:**
- Modify: `client/src/app/+games/game-community.tokens.scss`
- Modify: `client/src/app/header/game-navigation.component.scss`
- Modify: `client/src/app/header/header.component.scss`

- [ ] **Step 1: 添加共享字段和媒体 surface token**

在 `body` 和 `.game-experience` 的令牌块中增加 `--game-search-surface: #f1f2f3`、`--game-media-surface: #102f40`、`--game-media-surface-soft: #d7e8ef`、`--game-media-mark: #6e9caf`，并把内容宽度设为 `1240px`，保留现有品牌蓝、字体和圆角 token。

- [ ] **Step 2: 让搜索框呈现单层浅灰字段**

保留 `.game-navigation-search` 透明外壳和 input 的 `1px solid var(--game-border)` 基线契约；在非聚焦状态把 input 背景切换到 `var(--game-search-surface)`，聚焦时回到 `var(--game-surface)` 并只由 input 自己绘制 `var(--game-focus-ring)`。不添加 `:focus-within` 外框或第二个 form 边框。

- [ ] **Step 3: 收紧顶栏平台节奏**

保持 56px 高度、品牌/搜索/右侧入口的三列结构；减少右侧入口的横向空隙，投稿按钮保留 44px 触控高度并使用共享品牌 token。

- [ ] **Step 4: 运行样式契约**

Run `pnpm run verify:gamehub-style`. Expected: Task 2 相关 token/search 断言通过，Task 1 的模板断言仍失败。

### Task 3: 重做普通卡片的无封面海报层次

**Files:**
- Modify: `client/src/app/+games/game-card.component.html`
- Modify: `client/src/app/+games/game-card.component.scss`
- Modify: `client/src/app/+games/game-skeleton.component.scss`

- [ ] **Step 1: 先补充语义占位标记**

在无封面分支保留现有 `cover-watermark`，并追加以下内容，使占位卡即使没有图片也能表达品牌和内容类型：

```html
<span class="cover-poster-kicker" aria-hidden="true">GAMEHUB / PLAY</span>
<span class="cover-poster-index" aria-hidden="true">{{ categoryLabel() }}</span>
```

- [ ] **Step 2: 实现统一海报 fallback**

普通封面继续无外框卡片语义，但占位封面使用 `--game-media-surface-soft`，内部用 token border、品牌短线、kicker、首字和低对比序号组成平面海报；真实封面保持原样，不读取平均色、不引入渐变。标题、作者、播放/评论信息保持现有 DOM 和两行截断。

- [ ] **Step 3: 同步 skeleton 的密度和圆角**

让骨架封面、标题、作者的节奏与新卡片一致，避免加载态回到旧的松散灰块。

- [ ] **Step 4: 运行客户端契约与客户端 lint**

Run `pnpm run verify:gamehub-client`, `pnpm run verify:gamehub-style` and `pnpm --dir client run lint-scss`. Expected: card fallback/template assertions pass and no new raw visual values are reported.

### Task 4: 重构推荐主视觉和首页内容轨道

**Files:**
- Modify: `client/src/app/+games/games-home/featured-carousel.component.html`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.scss`
- Modify: `client/src/app/+games/games-home/_layout.scss`
- Modify: `client/src/app/+games/games-home/_sections.scss`
- Modify: `client/src/app/+games/games-home/_responsive.scss`
- Modify: `client/src/app/+games/games-home/game-section.component.ts`

- [ ] **Step 1: 给推荐主卡补充封面内标题层级**

在无封面和真实封面共同可用的 cover 位置加入 `featured-cover-copy`，展示 `推荐`、游戏标题和 `进入游戏` 的语义信息；不改变原来的独立标题链接、轮播按钮和 `aria-current`。

- [ ] **Step 2: 调整推荐区内容比例**

保留 12 列、主卡和侧栏各占 6 列的结构契约；把 `.featured-side-grid` 改为两列，精选卡封面和文字信息拥有可读宽度；主卡 footer 使用清晰的白色信息层，不再把控制器压在空白大色块上。

- [ ] **Step 3: 收紧普通区块**

共享 `_layout.scss`、`_sections.scss` 和 `GameSectionComponent` 的标题、网格和换一批控件保持相同数值：桌面五列，720px 以下两列；减少区块之间的无意义空白，给标题增加小型栏目说明和右侧动作的固定节奏。

- [ ] **Step 4: 用内置浏览器截图迭代首页**

启动任务本地预览端口，打开 `/games`，确认首屏主卡标题可读、右侧为两列、普通卡海报信息不重叠；检查搜索面板打开/关闭和 `document.documentElement.scrollWidth === innerWidth`。

### Task 5: 同步内容子页视觉语言

**Files:**
- Modify: `client/src/app/+games/game-rankings.component.scss`
- Modify: `client/src/app/+games/game-tags-cloud.component.scss`
- Modify: `client/src/app/+games/game-activity-feed.component.scss`
- Modify: `client/src/app/+games/game-author.component.scss`

- [ ] **Step 1: 统一内容页 header、Tab 和 surface**

把页面标题、Tab、筛选项、列表行和标签胶囊统一到共享 surface/border/text/brand token；普通列表使用白色内容 surface 的分组边界，保留 44px 操作高度和移动端规则。

- [ ] **Step 2: 改善榜单前三名层级**

仅用品牌蓝及其浅色 token 区分前三名，不引入金银铜多色；榜单封面无图时复用新的平面海报色阶。

- [ ] **Step 3: 运行样式和模板契约**

Run `pnpm run verify:gamehub-style`, `pnpm run verify:gamehub-client`, `pnpm --dir client run lint-scss`. Expected: all focused checks pass.

### Task 6: 文档、完整验证和交付

**Files:**
- Modify: `docs/releases/release-notes.md`
- Modify: `README.md`

- [ ] **Step 1: 更新发布说明**

在当天已有的 `2026-09-03` 发布记录下增加本轮内容广场视觉重构、海报式无封面 fallback、推荐侧栏两列和搜索单层边框修复；同步 README 的“最新更新”区块，不新增重复日期标题。

- [ ] **Step 2: 运行完整质量门禁**

使用临时 Node 22.23.2 路径，运行 `pnpm run self-test:gamehub`，不使用 `-SkipBuild`、`-SkipLint` 或 `-SkipLive`。记录 build、lint、SPA、资源和 live API 检查结果。

- [ ] **Step 3: 运行真实浏览器回归**

用内置浏览器验收 `/games`、`/games/rankings`、`/games/tags`、`/games/activity` 和搜索面板；保留最终截图作为视觉证据。不得停止或替换已有 9000 服务。

- [ ] **Step 4: 提交、合并、推送和清理**

运行 `git diff --check`，确认只包含预期文件；在任务分支使用 `git commit -s`，快进合并到 `develop`，推送 `origin/develop`，删除本次 worktree 和任务分支，执行 `git worktree prune`，最后验证 `develop == origin/develop`、工作区干净、任务目录不存在。
