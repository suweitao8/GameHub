# GameHub 投稿入口闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让顶部“投稿”入口在登录与未登录状态下都走明确、可回跳且不被导航遮挡的路径。

**Architecture:** 顶部组件根据 `AuthService` 的当前登录状态执行一次显式路由；`GameLoginGuard` 仍作为直链保护的第二道防线。CSS 只建立中间导航与右侧操作区的明确堆叠顺序，上传表单维持原有职责。

**Tech Stack:** Angular、Router、SCSS、Node.js 静态契约验证、PowerShell、浏览器运行时检查。

---

### Task 1: 锁定投稿入口的失败回归契约

**Files:**
- Modify: `scripts/verify-gamehub-client.mjs`

- [ ] **Step 1: 添加期望的入口断言**

```js
assert(
  headerHtml.includes('(click)="openGameUpload($event)"') &&
    headerTs.includes('openGameUpload (event: Event)') &&
    headerTs.includes("queryParams: { returnUrl: '/games/upload' }") &&
    headerScss.includes('z-index: 2;'),
  'GameHub submit action must explicitly preserve the upload return URL and stay above centered navigation'
)
```

- [ ] **Step 2: 运行 RED 检查**

Run: `pnpm run verify:gamehub-client`

Expected: 失败信息为 `GameHub submit action must explicitly preserve...`，因为点击处理函数和层级尚不存在。

### Task 2: 实现明确的投稿跳转与安全层级

**Files:**
- Modify: `client/src/app/header/header.component.html`
- Modify: `client/src/app/header/header.component.ts`
- Modify: `client/src/app/header/header.component.scss`

- [ ] **Step 1: 将投稿链接接入明确的点击处理**

```html
<a class="game-submit-button" href="/games/upload" routerLink="/games/upload"
   (click)="openGameUpload($event)" ...>投稿</a>
```

- [ ] **Step 2: 仅在未登录时将用户带到带回跳地址的登录页**

```ts
openGameUpload (event: Event) {
  if (this.authService.isLoggedIn()) return

  event.preventDefault()
  void this.router.navigate([ '/login' ], {
    queryParams: { returnUrl: '/games/upload' }
  })
}
```

- [ ] **Step 3: 将中间绝对导航置于底层、右侧操作区置于可点击层**

```scss
:host-context(.game-experience) .game-header-right {
  position: relative;
  z-index: 2;
}

@media screen and (min-width: 769px) {
  my-game-navigation { z-index: 1; }
}
```

- [ ] **Step 4: 运行 GREEN 检查**

Run: `pnpm run verify:gamehub-client`

Expected: 退出码 0。

### Task 3: 构建与真实路径验证

**Files:**
- Read: `client/src/app/+games/game-login.guard.ts`
- Read: `client/src/app/+login/login.component.ts`
- Read: `client/src/app/+games/game-upload.component.html`

- [ ] **Step 1: 运行变更文件的 lint 与客户端轻量构建**

Run: `pnpm exec eslint client/src/app/header/header.component.ts client/src/app/header/header.component.html && pnpm exec stylelint client/src/app/header/header.component.scss && pnpm run build:client:light`

Expected: 退出码 0；既有 CSS 预算警告可记录，但不能代替失败。

- [ ] **Step 2: 启动服务并检查健康接口**

Run: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9000/api/v1/ping`

Expected: `pong`。

- [ ] **Step 3: 在真实浏览器中点击投稿**

Expected: 未登录状态跳到 `/login?returnUrl=%2Fgames%2Fupload`；登录后会由现有登录组件回到上传页。

### Task 4: 完整门禁与交付

- [ ] **Step 1: 运行完整自检**

Run: `pnpm run self-test:gamehub`

Expected: 构建、静态契约、服务健康检查和 SPA 懒加载检查均通过。

- [ ] **Step 2: 检查和提交**

Run: `git diff --check; git status --short`

Expected: 仅包含本任务文件。

- [ ] **Step 3: 合并、推送并清理 worktree**

将提交合并到 `develop`，推送 `origin/develop`，保留主工作区已有的 `header.component.scss` 本地改动，然后删除当前 worktree。
