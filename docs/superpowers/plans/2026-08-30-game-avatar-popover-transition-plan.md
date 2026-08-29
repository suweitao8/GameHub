# GameHub 头像资料卡转场 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 GameHub 已登录顶栏的唯一头像在桌面端悬停/键盘聚焦时放大并移动到个人资料卡上沿中心，移除资料卡内的重复头像。

**Architecture:** 保留现有 Angular Header 的 popup signal、延迟关闭和点击路由，只在模板给头像容器增加由 `isOpenPopover('avatar')` 驱动的打开态 class。唯一 `.game-user-avatar` 继续作为按钮子节点，通过按钮外壳的 CSS `translate3d` 跨过 Header 与资料卡间隙，再由图片子节点 `scale` 放大；资料卡右边缘与头像容器右边缘对齐，资料卡只提供背景、名称、硬币和退出操作，并用顶部留白承接转场后的头像。打开态清除触发按钮 hover 阴影，避免原导航栏位置残留圆框。静态契约先锁定单头像、打开态几何、边缘约束、移动端退化和 reduced-motion，再用真实浏览器验证实际矩形位置与可操作性。

> **2026-08-30 补正：** 初版只移动了图片，导致触发按钮的 hover 圆框仍留在导航栏原位。本次补正把位移移到按钮外壳，图片只保留缩放，并明确打开态 `box-shadow: none`；这样头像和触发层的最终位置一致，原位不再留下空圆框。

**Tech Stack:** Angular template binding, component-scoped SCSS, Node.js source-contract verifier, Stylelint, GameHub self-test, real Chrome browser automation。

---

## 文件职责

- `client/src/app/header/header.component.html`：头像按钮和个人资料卡结构；只保留一张头像并让容器暴露打开态 class。
- `client/src/app/header/header.component.scss`：头像 transform 转场、资料卡右边缘约束、层级、资料卡顶部留白、移动端关闭空间转场、reduced-motion 规则。
- `scripts/verify-gamehub-client.mjs`：源码级回归契约，防止重新添加第二张头像或删除同一头像的转场几何。
- `docs/superpowers/specs/2026-08-30-game-avatar-popover-transition-design.md`：设计约束和验收标准。
- `docs/releases/release-notes.md`、`README.md`：实现完成后记录用户可见交互变化。

## Task 1: 增加会失败的单头像转场回归契约

**Files:**
- Modify: `scripts/verify-gamehub-client.mjs`，在现有 Header popup 契约之后增加头像转场断言。

- [x] **Step 1: 写出当前实现应失败的断言**

在已有 `submitHeaderHtml` 和 `submitHeaderScss` 断言附近加入：

```js
const gameAvatarOccurrences = submitHeaderHtml.match(/class="game-user-avatar"/g) || []
assert(
  gameAvatarOccurrences.length === 1 &&
    !submitHeaderHtml.includes('game-avatar-hover-avatar') &&
    submitHeaderHtml.includes(`[class.game-avatar-menu-open]="isOpenPopover('avatar')"`),
  'GameHub avatar popover must use one avatar element and expose its open state on the wrapper'
)
assert(
  submitHeaderScss.includes('.game-avatar-menu-open > .tertiary-button') &&
    submitHeaderScss.includes('transform: translate3d(calc((40px - 300px) / 2), calc(var(--header-height) / 2 + 0.5rem), 0);') &&
    submitHeaderScss.includes('box-shadow: none !important;') &&
    submitHeaderScss.includes('.game-avatar-menu-open > .tertiary-button .game-user-avatar') &&
    submitHeaderScss.includes('transform: scale(2.12);') &&
    submitHeaderScss.includes('transform-origin: center;') &&
    submitHeaderScss.includes('will-change: transform;') &&
    submitHeaderScss.includes('transition: box-shadow var(--game-dur) var(--game-ease),') &&
    submitHeaderScss.includes('transform var(--game-dur-slow) var(--game-ease);') &&
    submitHeaderScss.includes('padding: 4.25rem 1.1rem 1rem;'),
  'GameHub avatar popover must move the single avatar to the centered card edge with a tokenized transform and reserved profile space'
)
assert(
  submitHeaderScss.includes('overflow: visible;') &&
    submitHeaderScss.includes('z-index: 61;') &&
    submitHeaderScss.includes('@media screen and (max-width: $mobile-view)') &&
    submitHeaderScss.includes('transform: none;') &&
    submitHeaderScss.includes('right: 0;') &&
    submitHeaderScss.includes('width: min(300px, calc(100vw - 1rem));'),
  'GameHub avatar transition must keep the transformed image above the card, constrain the card edge, and disable cross-header motion on mobile'
)
```

- [x] **Step 2: 运行契约确认它因缺少目标行为而失败**

```powershell
node scripts/verify-gamehub-client.mjs
```

Expected: 现有契约通过，但新增断言报告重复头像、缺少打开态 class、缺少转场几何和移动端规则。确认失败原因是功能缺口，不是脚本语法错误。

## Task 2: 实现唯一头像的打开/关闭转场

**Files:**
- Modify: `client/src/app/header/header.component.html:57-97`
- Modify: `client/src/app/header/header.component.scss:829-1000, 1210-1220`

- [x] **Step 1: 让容器 class 由现有 popup 状态驱动，并删除重复图片**

在已登录 GameHub 的 `.logged-in-container` 上增加：

```html
[class.game-avatar-menu-open]="isOpenPopover('avatar')"
```

保留按钮中的唯一 `.game-user-avatar`，从 `.game-avatar-profile` 删除 `.game-avatar-hover-avatar`，只保留名称和硬币信息。不要修改 `openGameProfile`, `scheduleGameAvatarMenu`, `cancelGameAvatarHover` 或余额请求逻辑。

- [x] **Step 2: 为唯一头像准备不改变布局的基态**

在 `.game-user-avatar` 原有 34px 样式中保留头像源、圆形和边框，并加入：

```scss
transform-origin: center;
transition: transform var(--game-dur-slow) var(--game-ease),
  box-shadow var(--game-dur-slow) var(--game-ease);
will-change: transform;
```

- [x] **Step 3: 把头像触发层移动到资料卡上沿中心并置于卡片上层**

让 GameHub 头像按钮可以跨出自身盒子绘制：

```scss
:host-context(.game-experience) .logged-in-container > .tertiary-button {
  overflow: visible;
  position: relative;
  z-index: 61;
}
```

新增打开态：按钮外壳负责位移并清除原位 hover 圆框，图片子节点只负责缩放：

```scss
:host-context(.game-experience) .logged-in-container.game-avatar-menu-open > .tertiary-button {
  box-shadow: none !important;
  transform: translate3d(calc((40px - 300px) / 2), calc(var(--header-height) / 2 + 0.5rem), 0);
}

:host-context(.game-experience) .logged-in-container.game-avatar-menu-open > .tertiary-button .game-user-avatar {
  box-shadow: var(--game-shadow-popover);
  transform: scale(2.12);
}
```

资料卡自身继续使用 `z-index: 60`，改为右边缘对齐并使用 `max-width: calc(100vw - 1rem)` 与 `width: min(300px, calc(100vw - 1rem))`，窄屏时不会横向溢出；`.game-avatar-profile` 改为 `padding: 4.25rem 1.1rem 1rem`，给转场头像和名称之间留下稳定空间。

- [x] **Step 4: 明确移动端和 reduced-motion 行为**

在现有移动端 media query 增加：

```scss
@media screen and (max-width: $mobile-view) {
  :host-context(.game-experience) .logged-in-container.game-avatar-menu-open > .tertiary-button {
    transform: none;
  }

  :host-context(.game-experience) .logged-in-container.game-avatar-menu-open > .tertiary-button .game-user-avatar {
    transform: none;
  }
}
```

保留 reduced-motion 下 `.game-user-avatar { transition: none; }`，不要清除打开态最终 transform；移动端继续使用现有点击头像进入个人主页的行为。

- [x] **Step 5: 运行契约和 Header Stylelint**

```powershell
node scripts/verify-gamehub-client.mjs
pnpm --dir client exec stylelint src/app/header/header.component.scss
```

Expected: 契约通过，Stylelint 无错误。

## Task 3: 记录用户可见变化并完成编译验证

**Files:**
- Modify: `README.md` 的 `## 最新更新` 最新日期块。
- Modify: `docs/releases/release-notes.md` 的 `### 2026-08-30` 日期块；同日已有条目时合并。

- [x] **Step 1: 运行定向客户端检查**

```powershell
pnpm run verify:gamehub-client
pnpm --dir client run lint-scss
```

Expected: 两个命令退出码均为 0，样式契约仍扫描 53 个活动 GameHub 样式文件。

- [x] **Step 2: 运行 Sass 编译和轻量客户端构建**

```powershell
pnpm --dir client exec sass --load-path src/sass/include --load-path node_modules src/sass/application.scss $env:TEMP\gamehub-avatar-transition.css
pnpm run build:client:light
```

Expected: Sass 编译无错误，轻量构建完成。若 Angular CLI 的 Node 最小补丁版本检查阻断，使用本机临时 Node shim 仅暴露满足版本检查的 `process.versions.node`，不修改仓库配置，并在交付报告中注明。

- [x] **Step 3: 运行 GameHub 自检门禁**

确保既有后端 `http://127.0.0.1:9000/api/v1/ping` 可达后运行：

```powershell
pnpm run self-test:gamehub
```

Expected: 输出 `SELF-TEST PASS: build, static assets, and runtime entry checks passed.`；允许既有浏览器兼容性和组件样式预算 warning，但不得出现本次 Header 模板/SCSS 或静态契约的新错误。

- [x] **Step 4: 更新用户视角的发布说明**

在 2026-08-30 日期块记录：登录后的顶栏头像悬停/聚焦时会自然放大并移动到个人信息卡顶部，资料卡不再显示重复头像。README 只保留最新日期块并链接完整 release notes，不写文件路径或测试细节。

## Task 4: 真实浏览器回归头像转场

**Files:**
- Test: `client/src/app/header/header.component.html`
- Test: `client/src/app/header/header.component.scss`

- [x] **Step 1: 启动隔离的客户端预览**

使用已有后端 `http://127.0.0.1:9000` 和当前 worktree 的 Angular dev server，选择未占用端口（如 `4202`），不要使用 `8080`。若内置浏览器需要 Chrome 授权，使用隔离临时 profile 的 Chrome CDP 作为明确 fallback，并记录该事实。

- [x] **Step 2: 检查桌面端打开态的唯一头像和几何**

登录后打开 `/games`，用 pointer move 进入 `.logged-in-container`，等待约 450ms，然后执行：

```js
const wrapper = document.querySelector('.logged-in-container.game-avatar-menu-open')
const avatar = wrapper?.querySelector('.game-user-avatar')
const card = wrapper?.querySelector('.game-avatar-hover-card')
const rect = avatar?.getBoundingClientRect()
const cardRect = card?.getBoundingClientRect()
({
  avatarCount: document.querySelectorAll('.logged-in-container .game-user-avatar').length,
  duplicateCount: document.querySelectorAll('.game-avatar-hover-avatar').length,
  avatarWidth: rect?.width,
  avatarHeight: rect?.height,
  horizontalCenterDelta: rect && cardRect ? Math.abs((rect.left + rect.width / 2) - (cardRect.left + cardRect.width / 2)) : null,
  cardTop: cardRect?.top,
  avatarCenterY: rect ? rect.top + rect.height / 2 : null,
  viewportOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
})
```

Expected: `avatarCount=1`, `duplicateCount=0`, avatar dimensions approximately `72x72`, horizontal center delta `<=2px`, avatar vertical range covers the card top edge, the trigger button has no open-state box shadow and is translated with the avatar, and no viewport overflow。捕获打开态截图检查头像是否确实压在卡片上沿，而非卡片内又出现一张头像或在导航栏原位残留圆框。

- [x] **Step 3: 检查进入卡片、关闭回位和键盘路径**

从放大头像滑入 `.game-avatar-hover-card`，验证资料卡仍接收指针并命中“退出登录”按钮；为保护当前登录态，本轮不实际提交退出操作。随后将鼠标移出 wrapper，等待关闭延迟，确认头像回到约 `34x34` 的原位且卡片卸载。用脚本聚焦头像，确认 `aria-expanded="true"`、资料卡挂载、放大态生效，并在焦点移出后收回。

使用真实登录态浏览器完成了桌面端 pointer hover、卡片内 pointer 命中、退出按钮命中、鼠标移出关闭，以及头像 focus / 焦点移出路径；只将已有登录态安全复用到隔离预览，不打印令牌，也不点击退出登录。实际运行确认 TypeScript handler 未被改动，单头像转场和资料卡卸载行为保持正常。

- [x] **Step 4: 检查移动端和 reduced-motion**

在 375px 宽度下确认页面无横向溢出、真实头像点击仍进入原有 `/games/author/2` 个人主页路由，且不存在跨 Header 的 transform。开启 `prefers-reduced-motion: reduce` 后确认资料卡打开时头像直接处于最终中心位置、transition 为 `none`，没有动画闪烁。

## Task 5: 请求复核、提交并闭环交付

- [x] **Step 1: 检查改动范围**

```powershell
git diff --check
git status --short
```

Expected: 只包含 Header 模板/SCSS、契约脚本、README/release notes、spec/plan；不包含 `node_modules`、`dist`、截图、日志或本地配置。已用 `git diff --check` 和状态清单确认。

- [x] **Step 2: 请求代码复核**

复核重点：唯一头像是否真的由现有 popup 状态控制；transform 是否把头像中心准确放到卡片中心；放大头像是否遮挡退出按钮；pointer/focus 延迟关闭是否保留；移动端和 reduced-motion 是否完整；是否重新引入重复 `img`。复核发现的资料卡右边缘约束问题已修正，并重新运行了 Task 2-4 的定向验证。

- [x] **Step 3: 提交实现**

```powershell
git add client/src/app/header/header.component.html client/src/app/header/header.component.scss scripts/verify-gamehub-client.mjs README.md docs/releases/release-notes.md docs/superpowers/specs/2026-08-30-game-avatar-popover-transition-design.md docs/superpowers/plans/2026-08-30-game-avatar-popover-transition-plan.md
git commit -s -m 'feat(ui): 优化头像资料卡转场'
```

- [x] **Step 4: 合并、推送和清理**

在 worktree 干净且验证通过后，将提交合并回 `develop`，推送 `origin/develop`，确认本地与远程 SHA 相同，再删除本次 worktree 并执行 `git worktree prune`。最后运行：

```powershell
git status --short --branch
git diff --check
git branch --show-current
git log -1 --oneline --decorate
git worktree list --porcelain
git fetch origin --prune
$localDevelop = git rev-parse develop
$remoteDevelop = git rev-parse origin/develop
if ($localDevelop -ne $remoteDevelop) { throw 'develop 尚未与 origin/develop 同步' }
```

Expected: 当前基线为 `develop`，工作区干净，当前任务 worktree 已移除，且 `develop` 与 `origin/develop` 指向同一提交。
