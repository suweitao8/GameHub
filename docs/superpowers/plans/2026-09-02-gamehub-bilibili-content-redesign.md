# GameHub B 站启发式内容广场视觉重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 GameHub 从“灰色卡片集合”重构为以缩略图内容、频道层级和推荐主卡为核心的轻量内容广场，同时保留既有业务行为。

**Architecture:** 以 `game-community.tokens.scss` 作为唯一视觉令牌源；首页发现页用 `games-home` 的布局模块表达 12 列推荐区、文字频道栏和五列内容网格；`game-card` 负责统一缩略图卡片，header/search 负责平台壳层。只改模板结构和 SCSS，不改变 API、路由或推荐数据流。

**Tech Stack:** Angular standalone components, SCSS modules, existing GameHub tokens, existing static style/client verifiers, in-app browser.

---

### Task 1: 建立新的视觉回归契约

**Files:**
- Modify: `scripts/verify-gamehub-style.mjs`
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: 写 RED 契约**

  增加以下断言：品牌 token 必须使用 B 站启发式蓝色；频道栏必须使用文字 Tab 和底部激活线；卡片模板必须包含 `game-card-meta-line` 和 `game-card-category`；推荐布局必须采用 12 列且主卡/侧栏各占 6 列；标准卡片不得重新引入白盒边框阴影组合。

- [ ] **Step 2: 运行 RED 验证**

  Run: `pnpm run verify:gamehub-style`

  Expected: FAIL，失败原因来自当前旧的 teal token、胶囊频道栏、卡片模板和推荐布局。

- [ ] **Step 3: 提交 RED 检查点**

  Run: `git add scripts/verify-gamehub-style.mjs && git commit -s -m "test: add content-platform visual contracts"`

### Task 2: 重做令牌和频道栏

**Files:**
- Modify: `client/src/app/+games/game-community.tokens.scss`
- Modify: `client/src/sass/include/_css-variables.scss`
- Modify: `client/src/app/+games/games-home/_discovery-nav.scss`

- [ ] **Step 1: 将发现页令牌改为蓝色内容平台语义**

  保留 token 名称，调整品牌蓝、行动深蓝、浅蓝状态、页面背景和内容宽度；所有组件继续引用 `--game-*`，不在组件内写新的 raw color。

- [ ] **Step 2: 将频道栏改为文字 Tab**

  移除每一项的胶囊底色和圆角，使用 44px 最小高度、透明背景、底部 2px 激活线；横向滚动和键盘焦点保持不变。

- [ ] **Step 3: 运行样式契约**

  Run: `pnpm run verify:gamehub-style`

  Expected: 仍可能因卡片/推荐区断言失败，但令牌与频道栏相关失败消失。

### Task 3: 重构普通游戏卡片

**Files:**
- Modify: `client/src/app/+games/game-card.component.html`
- Modify: `client/src/app/+games/game-card.component.scss`

- [ ] **Step 1: 将统计信息移到标题下方**

  让 `.game-cover` 只承载真实封面或中性占位；新增 `.game-card-category` 和 `.game-card-meta-line`，把游玩/评论统计放在标题下面；作者继续留在主链接外，避免嵌套链接。

- [ ] **Step 2: 移除白盒卡片 chrome**

  普通卡片改为无外框内容单元，封面使用 8px 圆角和轻微 hover 反馈；分类标签、标题、作者和数据使用统一排版节奏；移动端保留两列和 44px 可操作目标。

- [ ] **Step 3: 运行样式契约并修复失败**

  Run: `pnpm run verify:gamehub-style`

  Expected: 普通卡片与模板相关断言通过。

### Task 4: 重构推荐主卡和首页节奏

**Files:**
- Modify: `client/src/app/+games/games-home/featured-carousel.component.scss`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.html`
- Modify: `client/src/app/+games/games-home/_layout.scss`
- Modify: `client/src/app/+games/games-home/_sections.scss`
- Modify: `client/src/app/+games/games-home/_responsive.scss`
- Modify: `client/src/app/+games/games-home/game-section.component.ts`

- [ ] **Step 1: 将推荐区改为 12 列内容布局**

  主卡占 6 列、侧栏占 6 列，桌面展示 2×3 侧卡；主卡控制区使用轻量白色信息栏，普通分区之间以稳定的标题间距分隔。

- [ ] **Step 2: 提升无封面主卡的视觉锚点**

  只使用一个深蓝语义底和低对比首字，真实图片路径仍优先；不增加渐变、随机色或运行时数据改变。

- [ ] **Step 3: 同步内联 `game-section` 样式**

  保持 `GameSectionComponent` 与父页面相同的 5 列/2 列网格、标题和换一批控件，避免 Angular 样式封装导致同类区块不一致。

### Task 5: 回归、截图和交互验收

**Files:**
- Modify: `docs/releases/release-notes.md` if user-visible changes are present
- Modify: `README.md` latest update block if release notes are added

- [ ] **Step 1: 运行 focused checks**

  Run: `pnpm --dir client run lint-scss`, `pnpm run verify:gamehub-style`, `pnpm run verify:gamehub-client`。

- [ ] **Step 2: 构建并启动可验收页面**

  Run: `pnpm run build:server`, `pnpm run build:client:light`; use the existing local service or a task-local port and verify `/api/v1/ping` before browser checks.

- [ ] **Step 3: 用内置浏览器截图并迭代**

  Inspect `/games` stable data state, search focus/suggestions, `/games/rankings`, `/games/tags`, `/games/upload`, and `/login`; confirm visual hierarchy, no double search border, no horizontal overflow, and no obvious loading state captured as the final design.

- [ ] **Step 4: 运行完整门禁**

  Run: `pnpm run self-test:gamehub -- -BaseUrl http://127.0.0.1:9001`

  Expected: `SELF-TEST PASS: build, static assets, and runtime entry checks passed.`

- [ ] **Step 5: 收尾提交与交付**

  Run: `git diff --check`, `git status --short`, `git commit -s`, merge into `develop`, push `origin/develop`, verify local/remote SHA equality, then remove only this task worktree and prune it.
