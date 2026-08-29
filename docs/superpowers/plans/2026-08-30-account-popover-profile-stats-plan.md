# 账户弹窗个人中心与统计实施计划

> **执行状态：** 已按本计划完成实现、结构测试、客户端构建、真实浏览器 smoke 验证和最终 GameHub 自检门禁；合并与推送在提交后进行。

**目标：** 将 GameHub 游戏态头像弹窗改造成可点击打开的个人资料卡，展示关注数、粉丝数和以游戏数量为语义的动态数，并提供个人中心与个人主页入口。

**架构：** 继续使用 HeaderComponent 现有的非模态 hover popover 和一次性 creatorOverview() 请求，不新增后端接口。头像按钮负责切换浮层，模板直接消费登录用户 account 的关系字段和 gameCount signal；浮层内容采用普通链接和按钮，保持鼠标、键盘焦点和移动端可操作。

**技术栈：** Angular 22 standalone component、signals、Angular Router、现有 GameHub CSS variables、Node structural verifier、ESLint、Stylelint、Angular production build、真实浏览器 smoke test。

---

### Task 1: 为账户弹窗增加失败优先的结构契约

**文件：**
- 修改：scripts/verify-gamehub-client.mjs，现有头像 hover contract 附近
- 测试：scripts/verify-gamehub-client.mjs

- [x] **步骤 1：先添加会失败的断言**

在现有头像 hover 断言后加入：

~~~js
assert(
  headerHtml.includes('id="game-avatar-menu"') &&
    headerHtml.includes('[attr.aria-controls]="\'game-avatar-menu\'"') &&
    headerHtml.includes('routerLink="/my-account"') &&
    headerHtml.includes('routerLink]="[ \'/games/author\', user.account.id ]"') &&
    headerHtml.includes('user?.account?.followingCount') &&
    headerHtml.includes('user?.account?.followersCount') &&
    headerHtml.includes('gameCount()'),
  'account popover must expose personal center, public profile, following, follower, and game-count content'
)
assert(
  headerTs.includes('readonly gameCount = signal<number | null>(null)') &&
    headerTs.includes('this.gameCount.set(overview.gameCount)') &&
    headerTs.includes('this.gameCount.set(null)') &&
    headerTs.includes('toggleGameAvatarMenu (event: MouseEvent)') &&
    headerTs.includes('closeGameAvatarMenu (event: KeyboardEvent)'),
  'account popover must load and clear game count and provide click and Escape interaction handlers'
)
assert(
  headerScss.includes('grid-template-columns: repeat(3, minmax(0, 1fr));') &&
    headerScss.includes('max-width: calc(100vw - 1rem);') &&
    headerScss.includes('.game-avatar-action:focus-visible') &&
    headerScss.includes('@media (prefers-reduced-motion: reduce)'),
  'account popover stats must have a three-column, viewport-safe, focus-visible, reduced-motion style contract'
)
~~~

- [x] **步骤 2：确认测试因目标功能缺失而失败**

运行：

~~~powershell
node scripts/verify-gamehub-client.mjs
~~~

预期：以非零状态退出，并出现上述三个账户弹窗断言消息。若出现语法错误，先修正测试断言本身，直到得到针对缺失功能的失败。

### Task 2: 实现账户数据状态和键盘安全的触发器行为

**文件：**
- 修改：client/src/app/header/header.component.ts
- 测试：scripts/verify-gamehub-client.mjs

- [x] **步骤 1：添加游戏数 signal 和头像按钮引用**

在 Angular import 中加入 ElementRef，保留 NgbDropdownModule，因为非游戏态下拉仍然使用它；移除未使用的 NgbDropdown viewChild，并加入：

~~~ts
readonly gameAvatarButton = viewChild<ElementRef<HTMLButtonElement>>('gameAvatarButton')
readonly gameCount = signal<number | null>(null)
~~~

- [x] **步骤 2：把头像点击从直接导航改为打开或关闭弹窗**

用下面的方法替换 openGameProfile，并在点击期间抑制由浏览器自动聚焦触发的重复打开：

~~~ts
toggleGameAvatarMenu (event: MouseEvent) {
  event.preventDefault()
  if (!this.loggedIn || !this.isGameExperience()) return

  if (this.isOpenPopover('avatar')) this.unmountPopoverNow('avatar')
  else this.scheduleGameAvatarMenu()
}

// Escape 由 @HostListener('window:keydown', [ '$event' ]) 统一处理，
// 头像按钮的 pointerdown/pointerup/pointercancel 负责避免 focusin 与 click 竞态。
~~~

- [x] **步骤 3：复用现有 overview 请求回写游戏数**

在 loadGameCoinBalance 的订阅中把成功和失败分支改成：

~~~ts
next: overview => {
  this.gameCoinBalance.set(overview.coinBalance)
  this.gameCount.set(overview.gameCount)
},
error: () => {
  this.gameCoinBalance.set(0)
  this.gameCount.set(null)
}
~~~

在登出清理逻辑中加入 this.gameCount.set(null)，保持 gameCoinBalanceRequested 的一次性请求保护。

- [x] **步骤 4：重新运行测试**

运行：

~~~powershell
node scripts/verify-gamehub-client.mjs
~~~

预期：状态处理断言通过；模板和样式断言仍失败。

### Task 3: 加入个人资料卡模板

**文件：**
- 修改：client/src/app/header/header.component.html
- 测试：scripts/verify-gamehub-client.mjs

- [x] **步骤 1：替换游戏态账户卡片**

在游戏态登录分支使用以下结构，保留外层 logged-in-container、pointerenter、pointerleave、focusin、focusout 和 isPopoverMounted 生命周期：

~~~html
<button
  #gameAvatarButton
  class="tertiary-button"
  type="button"
  aria-label="个人信息"
  aria-haspopup="true"
  [attr.aria-controls]="'game-avatar-menu'"
  [attr.aria-expanded]="isOpenPopover('avatar')"
  (pointerdown)="onGameAvatarPointerDown($event)"
  (pointerup)="onGameAvatarPointerUp($event)"
  (pointercancel)="onGameAvatarPointerUp($event)"
  (click)="toggleGameAvatarMenu($event)"
>
  <img class="game-user-avatar" [src]="getGameAvatarUrl()" [alt]="user?.account?.displayName || user?.username || 'GameHub 玩家'" (error)="onGameAvatarError($event)">
</button>
@if (isPopoverMounted('avatar')) {
  <section
    id="game-avatar-menu"
    class="game-avatar-hover-card"
    [class.game-popover-hidden]="isPopoverClosing('avatar')"
    aria-labelledby="game-avatar-title"
  >
    <div class="game-avatar-profile">
      <img class="game-avatar-hover-avatar" [src]="getGameAvatarUrl()" alt="" (error)="onGameAvatarError($event)">
      <strong id="game-avatar-title">{{ user?.account?.displayName || user?.username || 'GameHub 玩家' }}</strong>
      @if (user?.account?.name) { <span class="game-avatar-handle">&#64;{{ user.account.name }}</span> }
      <span class="game-avatar-coin">硬币 {{ gameCoinBalance() ?? 0 }}</span>
    </div>
    <div class="game-avatar-stats" aria-label="个人数据">
      <div class="game-avatar-stat">
        <strong>{{ user?.account?.followingCount ?? 0 }}</strong>
        <span>关注</span>
      </div>
      <div class="game-avatar-stat">
        <strong>{{ user?.account?.followersCount ?? 0 }}</strong>
        <span>粉丝</span>
      </div>
      <div class="game-avatar-stat">
        <strong [class.game-avatar-stat-loading]="gameCount() === null">{{ gameCount() ?? '-' }}</strong>
        <span>动态</span>
      </div>
    </div>
    <nav class="game-avatar-actions" aria-label="个人菜单">
      <a class="game-avatar-action game-avatar-action-primary" routerLink="/my-account">
        <my-global-icon iconName="user" aria-hidden="true"></my-global-icon>
        <span>个人中心</span>
        <my-global-icon class="game-avatar-action-arrow" iconName="chevron-right" aria-hidden="true"></my-global-icon>
      </a>
      @if (user?.account?.id) {
        <a class="game-avatar-action" [routerLink]="[ '/games/author', user.account.id ]">
          <my-global-icon iconName="user" aria-hidden="true"></my-global-icon>
          <span>我的主页</span>
          <my-global-icon class="game-avatar-action-arrow" iconName="chevron-right" aria-hidden="true"></my-global-icon>
        </a>
      }
    </nav>
    <div class="game-avatar-hover-actions">
      <button type="button" class="game-avatar-logout" (click)="logout($event)">
        <my-global-icon iconName="sign-out" aria-hidden="true"></my-global-icon>
        退出登录
      </button>
    </div>
  </section>
}
~~~

“动态”仍作为可见文案，但绑定值必须是 gameCount，而不是通知数量。加载或请求失败时显示短横线。

- [x] **步骤 2：运行结构测试**

运行：

~~~powershell
node scripts/verify-gamehub-client.mjs
~~~

预期：模板断言通过，样式断言仍失败。

### Task 4: 完成视觉层级、焦点状态和窄屏适配

**文件：**
- 修改：client/src/app/header/header.component.scss
- 测试：scripts/verify-gamehub-client.mjs

- [x] **步骤 1：为身份区、统计区和操作区补充样式**

在现有账户卡样式中加入以下规则，继续使用 GameHub 设计令牌：

~~~scss
.game-avatar-hover-card {
  max-width: calc(100vw - 1rem);
  right: 0;
  transform: none;
  width: min(18.5rem, calc(100vw - 1rem));
}

.game-avatar-handle {
  color: var(--game-text-hint);
  font-size: 0.76rem;
}

.game-avatar-coin {
  background: var(--game-surface-alt);
  border-radius: var(--game-radius-pill);
  color: var(--game-text-secondary);
  font-size: 0.76rem;
  padding: 0.18rem 0.7rem;
}

.game-avatar-stats {
  border-bottom: 1px solid var(--game-border);
  border-top: 1px solid var(--game-border);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 0.8rem 0.55rem;
}

.game-avatar-stat {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.game-avatar-stat strong {
  color: var(--game-text-primary);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.1;
}

.game-avatar-stat span {
  color: var(--game-text-hint);
  font-size: 0.72rem;
}

.game-avatar-stat-loading {
  color: var(--game-text-hint) !important;
}

.game-avatar-actions {
  display: grid;
  gap: 0.25rem;
  padding: 0.65rem 0.65rem 0.35rem;
}

.game-avatar-action {
  align-items: center;
  border-radius: var(--game-radius-sm);
  color: var(--game-text-secondary);
  display: flex;
  gap: 0.6rem;
  min-height: 44px;
  padding: 0.55rem 0.7rem;
  text-decoration: none;
  transition: background-color var(--game-dur-fast) var(--game-ease), color var(--game-dur-fast) var(--game-ease);
}

.game-avatar-action:hover,
.game-avatar-action:focus-visible,
.game-avatar-action-primary {
  background: var(--game-brand-soft);
  color: var(--game-brand-deep);
  outline: 0;
}

.game-avatar-action-arrow {
  height: 0.9rem;
  margin-left: auto;
  width: 0.9rem;
}

.game-avatar-action:focus-visible,
.game-avatar-stat:focus-visible,
.game-avatar-logout:focus-visible {
  outline: 2px solid var(--game-header-focus-ring);
  outline-offset: 2px;
}
~~~

- [x] **步骤 2：补充移动端和 reduced-motion 规则**

加入：

~~~scss
@media screen and (max-width: $mobile-view) {
  .game-avatar-hover-card {
    max-width: calc(100vw - 1rem);
    position: fixed;
    right: 0.5rem;
    top: calc(var(--header-height) + 0.5rem);
    width: min(18.5rem, calc(100vw - 1rem));
  }
}

@media (prefers-reduced-motion: reduce) {
  .game-avatar-action,
  .game-avatar-logout {
    transition: none;
  }
}
~~~

- [x] **步骤 3：运行结构测试和 Stylelint**

运行：

~~~powershell
node scripts/verify-gamehub-client.mjs
pnpm --filter ./client exec stylelint src/app/header/header.component.scss
~~~

预期：账户弹窗断言全部通过，Stylelint 返回 0。

### Task 5: 执行客户端 lint、构建和结构门禁

**文件：**
- 检查：client/src/app/header/header.component.ts
- 检查：client/src/app/header/header.component.html
- 检查：client/src/app/header/header.component.scss
- 检查：scripts/verify-gamehub-client.mjs

- [x] **步骤 1：运行变更文件 ESLint**

~~~powershell
pnpm --filter ./client exec eslint src/app/header/header.component.ts
~~~

预期：无 error 或 warning，退出码为 0。

- [x] **步骤 2：运行 GameHub 客户端验证器**

~~~powershell
pnpm run verify:gamehub-client
~~~

预期：源码结构和样式契约通过。

- [x] **步骤 3：构建客户端 light bundle**

~~~powershell
pnpm run build:client:light
~~~

预期：Angular production build 返回 0，并生成 client/dist/browser/en-US/index.html。

- [x] **步骤 4：构建后再次运行验证器**

~~~powershell
pnpm run verify:gamehub-client
~~~

预期：源码契约和构建产物检查均通过。

### Task 6: 使用真实浏览器验证账户弹窗

**文件：**
- 检查：由当前 worktree 构建并提供的 GameHub SPA
- 临时产物：截图和日志放在 Git 忽略目录或工作区外

- [x] **步骤 1：复用或启动本地服务**

先检查已有服务是否已经提供当前 worktree 的构建结果。没有时，从当前 worktree 启动本地服务，并避免停止或重配其他任务拥有的服务。

- [x] **步骤 2：验证桌面端登录流程**

使用登录测试账号验证（真实浏览器 smoke 已覆盖桌面弹窗、统计内容、个人中心路由和 Escape 焦点回收；窄屏检查先发现并修复了弹窗左溢出）：

1. 点击头像打开卡片，不会立即导航。
2. 卡片显示个人中心、关注、粉丝和动态。
3. 动态值等于 GET /api/v1/games/me/overview 返回的 gameCount。
4. 个人中心进入 /my-account，我的主页进入 /games/author/:id。
5. 鼠标从头像移动到卡片时不会误关闭。
6. 按 Escape 关闭卡片，并将焦点还给头像按钮。

- [x] **步骤 3：验证键盘、窄屏和异常状态**

从头像触发器检查 Tab、Enter、Space、Escape；检查游戏数请求加载和失败时的短横线回退；调整到窄屏确认没有水平溢出或操作项被裁切，修复后弹窗以 fixed + 视口安全边距定位。

- [x] **步骤 4：验证 reduced-motion 和最终差异**

开启 prefers-reduced-motion: reduce，确认浮层无淡入过渡，然后运行：

~~~powershell
git diff --check
git status --short
~~~

预期：无空白错误，且只有计划中的文件发生变化。

### Task 7: 提交实现

**文件：**
- 提交：计划中的 header、验证器、设计和计划文档

- [x] **步骤 1：提交前审查 Git 范围和用户可见变化**

运行：

~~~powershell
git diff --stat
git diff -- client/src/app/header/header.component.ts client/src/app/header/header.component.html client/src/app/header/header.component.scss scripts/verify-gamehub-client.mjs
git status --short
~~~

这是用户可见的账户菜单改进。提交前按 readme-release-updater 技能判断是否需要更新 docs/releases/release-notes.md 和 README 最新更新块。

- [x] **步骤 2：使用 sign-off 提交**

~~~powershell
git add client/src/app/header/header.component.ts client/src/app/header/header.component.html client/src/app/header/header.component.scss scripts/verify-gamehub-client.mjs README.md docs/releases/release-notes.md docs/superpowers/specs/2026-08-30-account-popover-profile-stats-design.md docs/superpowers/plans/2026-08-30-account-popover-profile-stats-plan.md
git commit -s -m "feat: 优化游戏态账户弹窗"
~~~

预期：在 codex/account-popover-profile-stats 分支产生带 sign-off 的提交，不绕过 hooks。
