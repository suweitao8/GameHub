# GameHub 浅色皮肤重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GameHub 的用户可见页面重构为参考 mydrama 浅色皮肤的低饱和、语义化界面，清除多彩占位和无语义渐变，修复搜索框双层边框，同时保留真实游戏内容和既有业务行为。

**Architecture:** 以 `game-community.tokens.scss` 作为游戏域语义令牌源，以 `_gamehub-ui.scss` 作为全局控件和页面壳层桥接。页面 SCSS 只消费语义变量；游戏卡片和特色推荐区分别移除随机色类和图片平均色背景。静态样式验证器先锁定契约，再按 header、首页、游戏域页面、账户认证和 PrimeNG 共享控件分组实施，最后通过 Angular 构建与内置浏览器验收。

**Tech Stack:** Angular, TypeScript, SCSS, CSS custom properties, Bootstrap 5, PrimeNG, pnpm, PowerShell, GameHub self-test, Codex 内置浏览器。

---

## Task 1: 锁定浅色主题和占位封面的回归契约

**Files:**
- Modify: `scripts/verify-gamehub-style.mjs`
- Test: `scripts/verify-gamehub-style.mjs`，使用现有 `pnpm run verify:gamehub-style`

- [ ] **Step 1: Write the failing contract checks**

在现有验证器中增加以下可执行断言。断言通过读取当前激活样式文件和首页卡片/推荐源码实现，不能依赖生成 bundle：

```js
assertIncludes(tokens, '--game-page-bg: #f5f5f5')
assertIncludes(tokens, '--game-surface: #ffffff')
assertIncludes(tokens, '--game-surface-alt: #f0f2f5')
assertIncludes(tokens, '--game-border: #e0e0e0')
assertIncludes(tokens, '--game-text-primary: #111b21')
assertIncludes(tokens, '--game-text-secondary: #667781')
assertIncludes(tokens, '--game-brand: #008198')
assertIncludes(tokens, '--game-accent: #3b82f6')
assertNotIncludes(tokens, '--game-accent: #fb7299')
assertNotIncludes(tokens, 'cover-tone-0')
assertNotIncludes(tokens, 'cover-tone-9')
assertNotIncludes(featuredTemplate, 'coverToneClass')
assertNotIncludes(featuredStyles, 'var(--cover-tone-a')
assertNotIncludes(featuredStyles, 'sampled-color fade')
```

同时保留现有 status、control、surface 和 raw-value 检查，新增的禁用项只针对产品壳层，不扫描运行时 iframe 的深色媒体样式。

- [ ] **Step 2: Run the verifier and confirm the expected failure**

Run:

```powershell
pnpm run verify:gamehub-style
```

Expected: `FAIL`，至少指出当前 token 仍为 `#f1fbfe`、accent 仍为粉色，或 `cover-tone`/平均色推荐代码仍存在。若断言因路径或解析错误失败，先修正验证器而不是修改生产样式。

- [ ] **Step 3: Commit the contract-only change**

```powershell
git add scripts/verify-gamehub-style.mjs
git commit -s -m "test: lock GameHub light skin contract"
```

## Task 2: 重建全局浅色令牌和控件桥接

**Files:**
- Modify: `client/src/app/+games/game-community.tokens.scss`
- Modify: `client/src/sass/include/_gamehub-ui.scss`
- Modify: `client/src/sass/include/_css-variables.scss`
- Modify: `client/src/sass/primeng.scss`
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: Replace the product-shell token values**

在 `:root` 的 GameHub token block 中保留已有变量名，替换其值为以下语义契约；状态色只保留给状态，不把 `warning`、`danger`、`success` 用于普通表面：

```scss
--game-page-bg: #f5f5f5;
--game-surface: #ffffff;
--game-card-bg: #ffffff;
--game-surface-alt: #f0f2f5;
--game-surface-active: #e9edef;
--game-page-wash: transparent;
--game-overlay: rgb(17 27 33 / 58%);
--game-text: #111b21;
--game-text-primary: #111b21;
--game-text-secondary: #667781;
--game-text-button: #53636b;
--game-text-hint: #7d8b92;
--game-muted: #667781;
--game-text-inverse: #ffffff;
--game-border: #e0e0e0;
--game-border-strong: #c9d1d5;
--game-brand: #008198;
--game-brand-vivid: #008198;
--game-brand-light: #d9f0f2;
--game-brand-hover: #006b7e;
--game-brand-deep: #005c6e;
--game-brand-soft: #edf8f8;
--game-brand-border: #b8dfe3;
--game-brand-glow: transparent;
--game-brand-contrast: #ffffff;
--game-accent: #3b82f6;
--game-accent-vivid: #3b82f6;
--game-accent-hover: #2563eb;
--game-accent-deep: #1d4ed8;
--game-accent-soft: #eff6ff;
--game-accent-glow: transparent;
--game-cover-fallback: #e9edef;
--game-cover-fallback-deep: #dce4e7;
--game-shadow-xs: 0 1px 2px rgb(17 27 33 / 5%);
--game-shadow: 0 2px 10px rgb(17 27 33 / 8%);
--game-shadow-lg: 0 8px 24px rgb(17 27 33 / 10%);
--game-shadow-popover: 0 12px 30px rgb(17 27 33 / 14%);
--game-shadow-brand: 0 2px 8px rgb(0 129 152 / 16%);
--game-shadow-accent: 0 2px 8px rgb(59 130 246 / 14%);
```

保留 `--game-success-*`、`--game-warning-*` 和 `--game-danger-*` 的语义用途，并将普通控件的 `--game-focus-ring` 统一为 `rgb(0 129 152 / 28%)`。

- [ ] **Step 2: Make the global bridge consume semantic surfaces**

在 `_gamehub-ui.scss` 中将 body、链接、按钮、input、textarea、select、`.game-surface`、`.game-panel`、`.game-section`、`.game-empty-state` 的背景、边框、文字和 focus-visible 规则统一指向 `--game-*`。普通按钮规则必须满足：

```scss
.game-button-primary {
  background: var(--game-brand);
  color: var(--game-text-inverse);
  border-color: var(--game-brand);
}

.game-button-primary:hover,
.game-button-primary:focus-visible {
  background: var(--game-brand-hover);
}

:where(button, a, input, textarea, select):focus-visible {
  outline: 2px solid var(--game-brand);
  outline-offset: 2px;
}
```

不覆盖 `.game-runtime-frame` 内部控件。

- [ ] **Step 3: Align legacy Bootstrap and PrimeNG mappings**

把 `_css-variables.scss` 中产品壳层的 `--primary`、`--bg`、`--bg-secondary`、`--fg` 映射到新的语义令牌；把 `primeng.scss` 的普通 panel、dropdown、input、button 和 overlay 规则改为语义变量。Toast 的 danger/success/warning 仍然使用状态色，阴影改为 `--game-shadow-popover`。

- [ ] **Step 4: Run the contract and focused style lint**

Run:

```powershell
pnpm run verify:gamehub-style
pnpm --dir client run lint-scss
```

Expected: 两条命令均为 exit 0；若旧页面仍依赖变量名，保留变量名并修正值，不在组件里重新写 raw hex。

- [ ] **Step 5: Commit the token layer**

```powershell
git add client/src/app/+games/game-community.tokens.scss client/src/sass/include/_gamehub-ui.scss client/src/sass/include/_css-variables.scss client/src/sass/primeng.scss scripts/verify-gamehub-style.mjs
git commit -s -m "style: establish mydrama light semantic skin"
```

## Task 3: 修复 Header、导航和搜索面板的单层视觉结构

**Files:**
- Modify: `client/src/app/header/header.component.scss`
- Modify: `client/src/app/header/game-navigation.component.scss`
- Modify: `client/src/app/menu/menu.component.scss`
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: Add a structural search regression assertion**

在验证器中读取 `client/src/app/header/header.component.html`、`game-navigation.component.html` 和其 SCSS，锁定以下规则：搜索输入的直接父级不能同时设置第二个可见 border；`.game-search-panel` 必须是独立 panel；搜索壳层不能引用旧粉色 accent 或彩色渐变。

```js
assertIncludes(navigationStyles, '.game-navigation-search')
assertIncludes(navigationStyles, '.game-search-panel')
assertIncludes(navigationStyles, 'border: 1px solid var(--game-border)')
assertNotIncludes(navigationStyles, 'linear-gradient')
assertNotIncludes(navigationStyles, 'var(--game-accent)')
```

- [ ] **Step 2: Run the regression assertion and confirm it fails**

Run `pnpm run verify:gamehub-style`。Expected: FAIL because the current search/header rules still contain pre-redesign gradient or repeated color declarations.

- [ ] **Step 3: Implement the single-control search composition**

让 `.game-navigation-search` 只负责 `position: relative`、宽度和布局，不设置第二个外框；让直接 input 拥有唯一边框、白色表面和 focus ring；让 `.game-search-panel` 独立绘制 panel 边框和阴影，并与输入框上下相接：

```scss
.game-navigation-search {
  position: relative;
  flex: 1 1 24rem;
  max-width: 34rem;
}

.game-navigation-search > input {
  width: 100%;
  min-height: 44px;
  padding: 0 3rem 0 1rem;
  border: 1px solid var(--game-border);
  border-radius: 12px;
  background: var(--game-surface);
  color: var(--game-text-primary);
  box-shadow: none;
}

.game-navigation-search > input:focus-visible {
  border-color: var(--game-brand);
  outline: 2px solid var(--game-focus-ring);
  outline-offset: 0;
}

.game-search-panel {
  position: absolute;
  inset: calc(100% + 8px) 0 auto;
  z-index: var(--game-z-popover);
  border: 1px solid var(--game-border);
  border-radius: 16px;
  background: var(--game-surface);
  box-shadow: var(--game-shadow-popover);
}
```

热门搜索、历史、联想、loading 和空结果继续用现有 DOM/事件，仅统一间距、文字和 hover/focus 状态。桌面 header 保持单行，375px 下搜索框独占一行但不溢出。

- [ ] **Step 4: Restyle header and menu surfaces**

将 header、账户菜单、移动菜单和通知入口改为 white surface + soft border；选中态使用 `--game-brand-soft` 和 `--game-brand`，不使用粉色背景。保持现有按钮 aria-label、菜单键盘行为、Esc 和点击外部关闭逻辑。

- [ ] **Step 5: Verify the search styles**

Run:

```powershell
pnpm run verify:gamehub-style
pnpm --dir client run lint-scss
```

Expected: exit 0。

- [ ] **Step 6: Commit the header change**

```powershell
git add client/src/app/header/header.component.scss client/src/app/header/game-navigation.component.scss client/src/app/menu/menu.component.scss scripts/verify-gamehub-style.mjs
git commit -s -m "fix: flatten GameHub search control layers"
```

## Task 4: 移除游戏卡片的多彩占位体系

**Files:**
- Modify: `client/src/app/+games/game-card.component.html`
- Modify: `client/src/app/+games/game-card.component.ts`
- Modify: `client/src/app/+games/game-card.component.scss`
- Modify: `client/src/app/+games/cover-tone.ts` 或删除（仅在引用审计确认无引用后）
- Modify: `client/src/app/+games/game-community.tokens.scss`
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: Add the no-color contract before implementation**

验证器必须断言 `game-card.component.html` 不再拼接 `coverToneClass()`，`game-card.component.ts` 不再 import `coverToneClass`，token 文件不包含 `.cover-tone-0` 到 `.cover-tone-9`。

- [ ] **Step 2: Run and observe the failing contract**

Run `pnpm run verify:gamehub-style`。Expected: FAIL on current `coverToneClass` import/class and ten palette blocks。

- [ ] **Step 3: Keep only content-derived placeholder identity**

保留 `coverInitial(title)` 的中性内容能力，将 card root 改成固定的 `game-card` class；没有真实封面时只输出 `.game-cover.placeholder`、`.cover-watermark` 和类别文本，不传递颜色 class。若 `cover-tone.ts` 只有首字母和色调函数，先用 `rg -n "coverTone|coverInitial|cover-tone" client/src` 完成引用审计，再把首字母函数移到一个语义命名 helper，最后删除无引用色调函数。

placeholder 样式使用：

```scss
.game-cover.placeholder {
  display: grid;
  place-items: center;
  background: var(--game-cover-fallback);
  color: var(--game-text-secondary);
}

.game-cover.placeholder .cover-watermark {
  color: var(--game-text-secondary);
  opacity: 0.28;
}
```

真实 `img` 的 object-fit、alt、加载失败 fallback 和统计信息保持不变。

- [ ] **Step 4: Unify card surfaces and metadata**

卡片使用 `var(--game-surface)`、`var(--game-border)`、14px radius 和 `var(--game-shadow-xs)`；hover 只提升 border/shadow，不改变封面色相。类别、推荐和上传者 badge 使用统一中性色或 primary soft background。

- [ ] **Step 5: Verify source and style contracts**

Run `pnpm run verify:gamehub-style` 和 `pnpm --dir client run lint-scss`。Expected: exit 0，并且 `rg -n "cover-tone|coverToneClass" client/src/app/+games client/src/sass` 只剩明确的非运行时文档或零结果。

- [ ] **Step 6: Commit card cleanup**

```powershell
git add client/src/app/+games/game-card.component.html client/src/app/+games/game-card.component.ts client/src/app/+games/game-card.component.scss client/src/app/+games/cover-tone.ts client/src/app/+games/game-community.tokens.scss scripts/verify-gamehub-style.mjs
git commit -s -m "style: neutralize game card placeholders"
```

## Task 5: 重构首页推荐和特色轮播

**Files:**
- Modify: `client/src/app/+games/games-home/featured-carousel.component.html`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.ts`
- Modify: `client/src/app/+games/games-home/featured-carousel.component.scss`
- Modify: `client/src/app/+games/games-home/_discovery-nav.scss`
- Modify: `client/src/app/+games/games-home/_sections.scss`
- Modify: `client/src/app/+games/games-home/_layout.scss`
- Modify: `client/src/app/+games/games-home/_responsive.scss`
- Modify: `client/src/app/+games/games-home.constants.ts`
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: Add the featured-area regression checks**

在验证器中断言特色轮播不再 import `FEATURED_PLACEHOLDER_AVG_RGB`，不再调用 `averageRgb` 或输出 `linear-gradient` 的动态 fade；首页 discovery nav 不再使用品牌/粉色渐变。

- [ ] **Step 2: Run the checks and confirm the expected failure**

Run `pnpm run verify:gamehub-style`。Expected: FAIL on the current average-color imports, methods and gradients。

- [ ] **Step 3: Simplify carousel data and markup**

保留轮播索引、自动播放、前后切换、键盘和 aria 状态，只删除颜色采样状态、`featuredColors`、`averageRgb`、`coverFadeStyle` 和占位平均色常量。真实封面继续使用 image；无封面时复用 card 的 neutral placeholder。

- [ ] **Step 4: Recompose the home surface**

特色区使用白色面板、细边框、14px/16px radius 和固定的浅色底；图片下方信息区使用正文/元数据层级。discovery nav 的 active state 使用 `--game-brand`，普通 tab 使用 `--game-surface-alt`，skeleton 使用纯色 surface transition 或现有 reduced-motion 规则。移除所有 page wash、colored footer fade、conic/radial decorative layers。

- [ ] **Step 5: Verify responsive home layout**

Run style checks, then use a local client build to verify the home template compiles. Expected: desktop recommendation grid has stable columns; under 768px it becomes one column or the existing intentional horizontal scroll region, with `body.scrollWidth === body.clientWidth`.

- [ ] **Step 6: Commit the home redesign**

```powershell
git add client/src/app/+games/games-home client/src/app/+games/games-home.constants.ts scripts/verify-gamehub-style.mjs
git commit -s -m "style: rebuild GameHub discovery surfaces"
```

## Task 6: 收敛游戏域页面的表面、状态和数据色

**Files:**
- Modify: `client/src/app/+games/game-about.component.scss`
- Modify: `client/src/app/+games/game-author.component.scss`
- Modify: `client/src/app/+games/game-creator.component.scss`
- Modify: `client/src/app/+games/game-articles.component.scss`
- Modify: `client/src/app/+games/game-article-detail.component.scss`
- Modify: `client/src/app/+games/game-article-editor.component.scss`
- Modify: `client/src/app/+games/game-comments.component.scss`
- Modify: `client/src/app/+games/game-discuss.component.scss`
- Modify: `client/src/app/+games/game-events.component.scss`
- Modify: `client/src/app/+games/game-event-detail.component.scss`
- Modify: `client/src/app/+games/game-event-admin.component.scss`
- Modify: `client/src/app/+games/game-community-panel.component.scss`
- Modify: `client/src/app/+games/game-collections.component.scss`
- Modify: `client/src/app/+games/game-collection-detail.component.scss`
- Modify: `client/src/app/+games/game-library.component.scss`
- Modify: `client/src/app/+games/game-following.component.scss`
- Modify: `client/src/app/+games/game-manage.component.scss`
- Modify: `client/src/app/+games/game-notifications.component.scss`
- Modify: `client/src/app/+games/game-rankings.component.scss`
- Modify: `client/src/app/+games/game-watch-later.component.scss`
- Modify: `client/src/app/+games/game-tags-cloud.component.scss`
- Modify: `client/src/app/+games/game-skeleton.component.scss`
- Modify: `client/src/app/+games/game-activity-feed.component.scss`
- Modify: `client/src/app/+games/game-reservations.component.scss`
- Modify: `client/src/app/+games/game-share-dialog.component.scss`
- Modify: `client/src/app/+games/game-report-dialog.component.scss`
- Modify: `client/src/app/+games/game-screenshots.component.scss` only for outer light shell; preserve lightbox dark surface
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: Create an audit-driven source list**

Run:

```powershell
rg -n --glob '*.scss' 'linear-gradient|radial-gradient|conic-gradient|#(fb7299|ff[0-9a-f]{4}|[89a-f][0-9a-f]{5})|var\\(--game-(accent|brand)-vivid\\)' client/src/app/+games
```

Classify each hit as product decoration, semantic status, chart series, runtime dark surface, or lightbox overlay. Only product decoration is changed. Keep chart series and status colors, but route them through existing semantic variables where possible.

- [ ] **Step 2: Add a controlled raw-color contract**

Extend `verify-gamehub-style.mjs` to reject product-page gradient declarations and raw decorative palette values in the listed files, while allowing explicit runtime/lightbox selectors and chart files. The allowlist must be selector- or file-specific, not a blanket ignore.

- [ ] **Step 3: Run the contract and confirm it detects existing debt**

Run `pnpm run verify:gamehub-style` and record the exact files it reports. Do not change the allowlist merely to make the baseline pass.

- [ ] **Step 4: Replace product decoration with semantic surfaces**

For each reported product surface:

```scss
.surface-or-panel {
  background: var(--game-surface);
  border: 1px solid var(--game-border);
  border-radius: 14px;
  box-shadow: var(--game-shadow-xs);
}

.secondary-surface {
  background: var(--game-surface-alt);
  color: var(--game-text-secondary);
}
```

Use status variables only on status badges/alerts. Remove watch-later’s brand-to-success gradient, about-page decorative orbit gradient, and ordinary page section gradients. Keep screenshots’ dark lightbox and play runtime’s dark controls.

- [ ] **Step 5: Verify state completeness while touching controls**

For every touched async action, confirm existing loading/disabled/error/success DOM still exists. For every dialog touched, confirm `role="dialog"`, `aria-modal`, title association, Esc and backdrop behavior remain unchanged. Add no new visible strings.

- [ ] **Step 6: Run SCSS and static verification**

Run `pnpm run verify:gamehub-style` and `pnpm --dir client run lint-scss` until both exit 0.

- [ ] **Step 7: Commit the games-domain skin**

```powershell
git add client/src/app/+games scripts/verify-gamehub-style.mjs
git commit -s -m "style: unify GameHub game pages"
```

## Task 7: 统一账户、认证、共享头像和表单控件

**Files:**
- Modify: `client/src/app/game-account-home.component.scss`
- Modify: `client/src/app/game-account-settings.component.scss`
- Modify: `client/src/app/game-not-found.component.scss`
- Modify: `client/src/app/+login` styles
- Modify: `client/src/app/+signup` styles
- Modify: `client/src/app/+reset-password` styles
- Modify: `client/src/app/shared/shared-main/buttons/button.component.scss`
- Modify: `client/src/app/shared/shared-main/buttons/copy-button.component.scss`
- Modify: `client/src/app/shared/shared-main/common/alert.component.scss`
- Modify: `client/src/app/shared/shared-main/common/link.component.scss`
- Modify: `client/src/app/shared/shared-actor-image/actor-avatar.component.scss`
- Modify: `client/src/app/shared/game-avatar.ts` only if its generated colors affect the visible product shell
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: Add form and avatar contract checks**

Assert that shared controls use semantic variables for ordinary backgrounds and borders, primary controls use white foreground on `--game-brand`, and avatar fallback colors do not introduce a rainbow palette into page surfaces. Preserve status/error colors and actual avatar images.

- [ ] **Step 2: Run and observe the expected failure**

Run `pnpm run verify:gamehub-style`。Expected: FAIL on raw shared avatar colors or legacy form mappings found by the audit.

- [ ] **Step 3: Restyle shared controls without changing fields**

Keep all input names, form order and validation messages. Apply 44px minimum interactive height, 12px field radius, visible placeholder contrast, semantic focus ring, disabled opacity/cursor, and inline error styling. Do not introduce new text or change `$localize`/i18n content.

- [ ] **Step 4: Reduce avatar fallback noise safely**

Use one neutral fallback surface plus a readable text color for generated initials. Keep actual uploaded/user-provided avatar images. If `game-avatar.ts` palettes are used only for an image generated as content, leave them unchanged; if they feed a shell avatar fallback, replace with the neutral token and add a focused test.

- [ ] **Step 5: Verify authentication and account states**

Run style checks and inspect templates for loading, invalid, disabled, server-error and success states. Expected: no form loses its label, aria-label, error text or submit lock.

- [ ] **Step 6: Commit shared/account skin**

```powershell
git add client/src/app/game-account-home.component.scss client/src/app/game-account-settings.component.scss client/src/app/game-not-found.component.scss client/src/app/+login client/src/app/+signup client/src/app/+reset-password client/src/app/shared scripts/verify-gamehub-style.mjs
git commit -s -m "style: align account and shared controls"
```

## Task 8: 保留运行时深色区域并完成 PrimeNG/响应式收口

**Files:**
- Modify: `client/src/app/+games/game-play` styles only for outer shell selectors
- Modify: `client/src/app/core/theme/primeng` theme files
- Modify: `client/src/sass/z-index.scss` only if the search/popover layer requires an existing named layer
- Modify: `client/src/sass/application.scss` only if import order needs correction
- Test: `scripts/verify-gamehub-style.mjs`

- [ ] **Step 1: Add runtime boundary assertions**

Assert that `_runtime-frame.scss` keeps dark runtime variables/backgrounds, while outer play page selectors use `--game-surface` and `--game-page-bg`. Assert PrimeNG overlays use the same popover surface and z-index name as the search panel.

- [ ] **Step 2: Run the boundary checks**

Run `pnpm run verify:gamehub-style`。Expected: any accidental lightening of runtime or overlay mismatch fails before build.

- [ ] **Step 3: Implement boundary-safe styles**

Do not alter iframe content or game controls. Only restyle related-game cards, descriptions, outer action rows, PrimeNG dropdowns, autocomplete, chips, paginator, datatable, dialog and toast shell. Use semantic tokens and preserve status colors.

- [ ] **Step 4: Check responsive overflow contracts**

Ensure `.game-navigation-search`, panel, cards, tables and dialog content use `min-width: 0`, bounded widths and explicit mobile collapse. Do not use a global `overflow-x: hidden` as a fix for a child overflow.

- [ ] **Step 5: Run style verification**

Run `pnpm run verify:gamehub-style` and `pnpm --dir client run lint-scss`。

- [ ] **Step 6: Commit runtime/PrimeNG boundary work**

```powershell
git add client/src/app/+games/game-play client/src/app/core/theme/primeng client/src/sass scripts/verify-gamehub-style.mjs
git commit -s -m "style: finish light shell and runtime boundaries"
```

## Task 9: Build and perform real browser acceptance

**Files:**
- Modify: only files identified by fresh build/browser failures
- Test: `pnpm run verify:gamehub-client`, `pnpm run build:client:light`, Codex 内置浏览器

- [ ] **Step 1: Run the focused client verifier**

Run:

```powershell
pnpm run verify:gamehub-client
```

Expected: client source, style and locale checks all exit 0.

- [ ] **Step 2: Build the light client with the supported Node version**

Use `C:\Users\su\AppData\Local\Temp\gamehub-node-22.23.2\node-v22.23.2-win-x64` at the front of PATH and run:

```powershell
pnpm run build:client:light
```

Expected: en-US light client build succeeds without TypeScript, template or Sass errors.

- [ ] **Step 3: Start or reuse the local server from the task worktree**

If a server is already serving the old main worktree, start the task worktree’s built server on an available local preview port without stopping unrelated services. Check `/api/v1/ping` and the SPA entry before browser work.

- [ ] **Step 4: Use the Codex in-app browser for visual acceptance**

Open `/games` at desktop width and verify:

1. Header is white with one search input border.
2. Hot-search panel is a separate white panel below the input.
3. Cards with missing covers are neutral, not red/yellow/purple/blue.
4. Real cover images remain visible.
5. Sections have consistent whitespace, borders and text hierarchy.

Open a game detail/play route, a community or library route, and an account or auth route. Verify one loading/empty/error state where available. At approximately 375px, verify no horizontal overflow, usable touch targets and a search panel that remains inside the viewport. Capture fresh screenshots for the review record.

- [ ] **Step 5: Verify search keyboard flow**

Focus the search input with keyboard, type a query, move through suggestions with arrows/Tab, activate with Enter, and close with Escape. Confirm the panel state changes without duplicating the input border or trapping focus outside the expected control.

- [ ] **Step 6: Commit only fixes proven by browser/build evidence**

```powershell
git diff --check
git status --short
git commit -s -am "fix: resolve light skin browser regressions"
```

If no browser regression fixes are needed, skip the empty commit.

## Task 10: Run the full gate and deliver through develop

**Files:**
- Modify: `docs/releases/release-notes.md`
- Modify: `README.md` only if the existing latest-update section requires a user-visible entry
- Test: full GameHub gate and Git state checks

- [ ] **Step 1: Update release documentation for the visible redesign**

Add one concise release-note entry describing the new light semantic shell, neutral placeholders and search-layer fix. Preserve the existing release-note format and do not claim unverified routes.

- [ ] **Step 2: Run the required final commands from the task worktree**

```powershell
git diff --check
pnpm run build:server
pnpm run verify:gamehub-client
pnpm run build:client:light
pnpm run self-test:gamehub
```

Expected: every command exits 0. If top-level `pnpm run lint` is attempted and Windows lacks WSL `/bin/bash`, report that exact environmental blocker while still running the project’s Windows-native equivalent checks required by the repository.

- [ ] **Step 3: Commit the release documentation and final source**

```powershell
git add docs/releases/release-notes.md README.md
git commit -s -m "docs: record GameHub light skin redesign"
```

- [ ] **Step 4: Confirm task branch is clean and merge to develop**

From the main checkout, inspect `git status --short --branch` and all worktrees. Merge the task branch into `develop` with a fast-forward when possible, otherwise resolve only real conflicts and rerun the full gate. Push explicitly with `git push origin develop`.

- [ ] **Step 5: Perform the repository closing audit**

Run from `D:\Github\GameHub`:

```powershell
git fetch origin --prune
$localDevelop = git rev-parse develop
$remoteDevelop = git rev-parse origin/develop
if ($localDevelop -ne $remoteDevelop) { throw 'develop 尚未与 origin/develop 同步' }
git status --short --branch
git diff --check
git branch --show-current
git log -1 --oneline --decorate
git worktree list --porcelain
git merge-base --is-ancestor codex/light-skin-redesign develop
if (Test-Path -LiteralPath 'D:\Github\_worktrees\GameHub\light-skin-redesign') { throw '任务 worktree 尚未清理' }
```

- [ ] **Step 6: Remove only this task worktree and prune registration**

After the branch is merged, verify its path and branch are the task-created targets, then remove `D:\Github\_worktrees\GameHub\light-skin-redesign` and run `git worktree prune`. Never remove other worktrees, local databases, generated artifacts owned by another task, or the previous `codex/blue-brand-redesign` branch.
