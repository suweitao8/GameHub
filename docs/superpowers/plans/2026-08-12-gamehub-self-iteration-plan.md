# GameHub 前端契约自洽与动效可访问性实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 GameHub 最近视觉改动造成的验证契约漂移，并让游戏首页与导航动效尊重 `prefers-reduced-motion`。

**Architecture:** 保留现有 Angular 组件边界，只在现有组件样式和静态契约脚本中做局部调整。验证脚本继续作为 GameHub 的源码/构建门禁，动效规则由各自拥有样式的组件负责，避免把组件内部样式搬到全局。

**Tech Stack:** Angular、SCSS、TypeScript、Node.js 静态验证脚本、PowerShell、真实浏览器。

---

### Task 1: 先锁定减少动态效果的失败契约

**Files:**
- Modify: `scripts/verify-gamehub-client.mjs:369-378, 486-501, 1157-1165, 1229-1233, 1342-1349`

- [ ] **Step 1: 更新现有断言到当前实现**

  将轮播渐隐断言改为 `height: 15%`，换一批字距改为 `letter-spacing: 0.02em`，弹窗封面改检查 `.game-nav-cover` 的 `height: 2.6rem` 与 `width: 4.6rem`，导航透明态断言只匹配导航 selector，页脚兜底色改为当前深蓝灰 `#262f37`。

- [ ] **Step 2: 添加动效可访问性断言并运行 RED**

  在现有首页样式读取区增加：

  ```js
  assert(
    headerScss.includes('@media (prefers-reduced-motion: reduce)') &&
      featuredScss.includes('@media (prefers-reduced-motion: reduce)') &&
      gameSectionTs.includes('@media (prefers-reduced-motion: reduce)') &&
      gamesHomeScss.includes('@media (prefers-reduced-motion: reduce)'),
    'GameHub hover and carousel motion must respect prefers-reduced-motion'
  )
  ```

  运行 `pnpm run verify:gamehub-client`，预期只剩新增的减少动态效果契约失败。

### Task 2: 为现有动效补齐减少动态效果规则

**Files:**
- Modify: `client/src/app/+games/games-home/featured-carousel.component.scss`
- Modify: `client/src/app/+games/games-home/game-section.component.ts`
- Modify: `client/src/app/+games/games-home/_sections.scss`
- Modify: `client/src/app/header/header.component.scss`

- [ ] **Step 1: 为轮播与共享换一批按钮禁用动画和过渡**

  在各自样式末尾增加 `@media (prefers-reduced-motion: reduce)`，将换一批图标 hover/focus 的 `animation` 设为 `none`，并将按钮、点位和颜色过渡设为 `none`。

- [ ] **Step 2: 为顶部导航禁用图标弹跳和弹窗淡入**

  在 header 样式末尾增加减少动态效果规则，覆盖 `.game-header-actions a my-global-icon`、`.game-header-popover-anim`、`.game-nav-preview`、`.game-submit-button` 的动画或过渡。

- [ ] **Step 3: 运行 GREEN 验证**

  运行 `pnpm run verify:gamehub-client`，预期所有 GameHub 静态契约通过。

### Task 3: 构建与真实交互验证

**Files:**
- Read: `client/src/app/+games/games-home.component.html`
- Read: `client/src/app/+games/game-play.component.html`
- Read: `client/src/app/header/header.component.html`

- [ ] **Step 1: 运行涉及文件的 lint/构建检查**

  运行客户端样式检查、客户端构建和 `pnpm run build:server`，记录已有预算警告但不把警告当成通过理由。

- [ ] **Step 2: 启动 develop 构建并检查接口**

  保持 `http://127.0.0.1:9000`，确认 `/api/v1/ping` 返回 `pong`，并检查首页入口和懒加载资源响应成功。

- [ ] **Step 3: 真实浏览器验证**

  检查首页推荐轮播、换一批按钮、顶部游戏导航和游戏详情页；验证导航 hover/active 不出现背景块，弹窗封面尺寸固定且图片失败时仍有占位。若内置浏览器连接不可用，使用已安装浏览器进行同等真实页面验证并记录替代原因。

### Task 4: 收尾

- [ ] **Step 1: 运行完整门禁**

  运行 `pnpm run self-test:gamehub`。

- [ ] **Step 2: 检查提交范围**

  运行 `git diff --check` 与 `git status --short`，确认只包含本任务文件。

- [ ] **Step 3: 提交、合并、推送并清理**

  在 worktree 提交后合并到 `develop`，恢复并保留主工作区现有导航栏居中改动，推送 `origin/develop`，确认本地与远程同一提交后删除当前 worktree。
