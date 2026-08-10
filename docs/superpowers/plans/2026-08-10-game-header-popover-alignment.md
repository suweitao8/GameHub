# GameHub 游戏导航弹窗与投稿按钮对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复游戏页历史/创作中心弹窗的图标锚点偏移，并让投稿按钮文字稳定垂直居中。

**Architecture:** 只修改 header 组件的局部 SCSS 和既有 GameHub 源码契约。弹窗继续由现有 Angular hover/focus 状态控制，CSS 用继承的横向偏移变量统一定位与动画，历史和创作中心恢复到 action wrapper 的中心锚点；投稿按钮继续使用现有 flex 布局。

**Tech Stack:** Angular templates, SCSS/Stylelint, Node.js contract script, GameHub self-test, in-app browser。

---

## 文件职责

- `client/src/app/header/header.component.scss`：顶部游戏导航、弹窗定位/箭头、投稿按钮的局部样式。
- `scripts/verify-gamehub-client.mjs`：读取源码并阻止弹窗动画覆盖横向定位、历史/创作中心脱离入口以及投稿按钮缺少明确行高的回归契约。

## Task 1: 先写会失败的回归契约

**Files:**
- Modify: `scripts/verify-gamehub-client.mjs:333-345, 900-1005`

- [ ] **Step 1: 增加弹窗与投稿按钮的目标契约**

在已有 `headerScss` 读取和 header 导航断言附近增加轻量的 CSS block 读取器，使用括号深度解析，并只接受选择器后直接跟 `{` 的命中，避免误命中 `:focus-visible` 等伪类。分别读取基础弹窗、fade-in 的 `from/to`、历史、创作中心和投稿按钮 block，再断言定位契约：基础弹窗使用 `--game-popover-x` 和 `--game-popover-edge-shift`，动画两端复用该组合；箭头使用反向补偿继续指向 action wrapper 中心；历史和创作中心回到 action wrapper 中心；不再使用会覆盖箭头定位的最后一个 action 特殊规则；投稿按钮明确设置 `line-height: 1` 和 `align-items: center`。

```js
function readCssBlock (source, selector) {
  let selectorStart = source.indexOf(selector)
  while (selectorStart >= 0) {
    const selectorTail = source.slice(selectorStart + selector.length)
    if (/^\s*\{/.test(selectorTail)) {
      const blockStart = source.indexOf('{', selectorStart + selector.length)
      let depth = 0
      for (let index = blockStart; index < source.length; index++) {
        if (source[index] === '{') depth += 1
        if (source[index] !== '}') continue
        depth -= 1
        if (depth === 0) return source.slice(blockStart + 1, index)
      }
      return ''
    }
    selectorStart = source.indexOf(selector, selectorStart + selector.length)
  }
  return ''
}

const popoverFadeInKeyframe = readCssBlock(headerScss, '@keyframes game-popover-fade-in')
const popoverFadeInFrom = readCssBlock(popoverFadeInKeyframe, 'from')
const popoverFadeInTo = readCssBlock(popoverFadeInKeyframe, 'to')
const basePopoverBlock = readCssBlock(headerScss, '.game-header-popover')
const historyPopoverBlock = readCssBlock(headerScss, '.game-header-history-popover')
const creatorPopoverBlock = readCssBlock(headerScss, '.game-header-creator-popover')
const submitButtonBlock = readCssBlock(headerScss, '.game-submit-button')
assert(
  basePopoverBlock.includes('--game-popover-x: -50%;') &&
    basePopoverBlock.includes('--game-popover-edge-shift: 0%;') &&
    popoverFadeInFrom.includes('translateX(calc(var(--game-popover-x) - var(--game-popover-edge-shift)))') &&
    popoverFadeInTo.includes('translateX(calc(var(--game-popover-x) - var(--game-popover-edge-shift)))') &&
    basePopoverBlock.includes('position: absolute;') &&
    basePopoverBlock.includes('transform: translateX(calc(var(--game-popover-x) - var(--game-popover-edge-shift)));') &&
    headerScss.includes('left: calc(50% + var(--game-popover-edge-shift));') &&
    headerScss.includes('@media screen and (min-width: $mobile-view + 1px) and (max-width: $mobile-view + 30px)') &&
    headerScss.includes('@media screen and (min-width: $mobile-view + 31px) and (max-width: $mobile-view + 60px)') &&
    headerScss.includes('@media screen and (min-width: $mobile-view + 61px) and (max-width: $small-view)') &&
    headerScss.includes('--game-popover-edge-shift: 3rem;') &&
    headerScss.includes('--game-popover-edge-shift: 2rem;') &&
    headerScss.includes('--game-popover-edge-shift: 0.5rem;') &&
    historyPopoverBlock.includes('left: 50%;') &&
    historyPopoverBlock.includes('right: auto;') &&
    !historyPopoverBlock.includes('transform: none;') &&
    creatorPopoverBlock.includes('left: 50%;') &&
    creatorPopoverBlock.includes('right: auto;') &&
    !creatorPopoverBlock.includes('position: fixed;') &&
    !creatorPopoverBlock.includes('transform: none;') &&
    !creatorPopoverBlock.includes('top: 61px;') &&
    !headerScss.includes('.game-header-action-wrap:last-child .game-header-popover::before') &&
    submitButtonBlock.includes('align-items: center;') &&
    submitButtonBlock.includes('line-height: 1;'),
  'GameHub header popovers must stay centered on their action icons and the submit label must use an explicit centered line-height'
)
```

- [ ] **Step 2: 运行契约确认当前实现确实失败**

Run from `D:\Github\_worktrees\GameHub\header-popover-alignment`:

```powershell
node scripts/verify-gamehub-client.mjs
```

Expected: FAIL at the new header popover alignment assertion because the current stylesheet uses `translateX(-50%)` directly in the animation, keeps history right-aligned, keeps creator fixed to the viewport, and has no explicit submit-button line-height.

## Task 2: 用一个横向变量统一弹窗定位和淡入动画

**Files:**
- Modify: `client/src/app/header/header.component.scss:284-321, 537-550, 577-581, 620-639`

- [ ] **Step 1: 让基础弹窗和动画共享横向偏移**

在 `.game-header-popover` 的声明块顶部增加 `--game-popover-x: -50%;` 和默认值为 `0%` 的 `--game-popover-edge-shift`，把基础 `transform` 改为减去边缘保护偏移。将 `@keyframes game-popover-fade-in` 的起止状态都改为使用同一个组合，再叠加现有的纵向位移；箭头对边缘保护偏移做反向补偿：

```scss
.game-header-popover {
  --game-popover-edge-shift: 0%;
  --game-popover-x: -50%;
  transform: translateX(calc(var(--game-popover-x) - var(--game-popover-edge-shift)));
}

@keyframes game-popover-fade-in {
  from {
    opacity: 0;
    transform: translateX(calc(var(--game-popover-x) - var(--game-popover-edge-shift))) translateY(-0.35rem);
  }

  to {
    opacity: 1;
    transform: translateX(calc(var(--game-popover-x) - var(--game-popover-edge-shift))) translateY(0);
  }
}

.game-header-popover::before {
  left: calc(50% + var(--game-popover-edge-shift));
}
```

- [ ] **Step 2: 让历史和创作中心使用入口中心锚点**

将两个特例改成相同的 action-wrapper 相对定位：`left: 50%`、`right: auto`，并删除创作中心的 `position: fixed`、`top: 61px`、`transform: none`。基础 `.game-header-popover` 已提供 `position: absolute` 和 `top: calc(100% + 0.5rem)`，因此不复制这些规则。

```scss
.game-header-creator-popover {
  left: 50%;
  padding: 0.45rem 0;
  right: auto;
  width: 13rem;
}

.game-header-history-popover {
  left: 50%;
  right: auto;
}
```

删除 `.game-header-action-wrap:last-child .game-header-popover::before` 特殊覆盖，让创作中心也使用基础箭头的中心定位和边缘保护补偿，从而与图标中心一致。

在移动端隐藏断点上方的三个窄屏区间分别设置 `--game-popover-edge-shift` 为 `3rem`、`2rem` 和 `0.5rem`。这只移动弹窗主体，基础箭头通过反向变量仍指向入口中心；超过 `$small-view` 后恢复默认的完全中心对齐。

- [ ] **Step 3: 明确投稿按钮的文字行高**

在 `.game-submit-button` 中保留现有 `display: inline-flex`、`align-items: center`、高度、内边距和颜色，只增加：

```scss
line-height: 1;
```

- [ ] **Step 4: 运行回归契约和变更文件 Stylelint**

```powershell
node scripts/verify-gamehub-client.mjs
pnpm --dir client exec stylelint src/app/header/header.component.scss
```

Expected: both commands exit with code 0; the contract reports `GameHub client source contracts passed.` and Stylelint reports no errors.

## Task 3: 构建并验证视觉与交互

**Files:**
- Test: `client/src/app/header/header.component.scss`
- Test: `scripts/verify-gamehub-client.mjs`

- [ ] **Step 1: 运行不含 live 服务的 GameHub 门禁**

```powershell
pnpm run self-test:gamehub -- -SkipLive
```

Expected: server build, light client build, lint/schema/contracts all pass. Existing non-blocking browser-support/style-budget warnings may remain, but no new error may reference the changed files.

- [ ] **Step 2: 在真实浏览器检查桌面端弹窗锚点**

打开 `http://127.0.0.1:9000/games`，将鼠标移入“历史”和“创作中心”，分别读取入口和弹窗的 `getBoundingClientRect()`：弹窗中心与入口中心的水平差应不超过 1px；箭头位于同一中心线；弹窗内容仍可点击，鼠标移入弹窗后不会立即关闭。

- [ ] **Step 3: 检查投稿按钮与窄屏布局**

在桌面端和窄屏桌面端检查 `.game-submit-button`：按钮高度、宽度、颜色保持不变，文字行盒位于按钮垂直中心；检查页面 `document.documentElement.clientWidth` 和 `window.innerWidth`，且历史/创作中心弹窗的主体左右边界均在 layout viewport 内。窄屏边缘保护只移动主体，箭头仍应落在入口中心；创作中心弹窗使用 `13rem` 宽度，两个提示词按钮文案必须完整显示。

- [ ] **Step 4: 运行完整交付门禁**

确保 `http://127.0.0.1:9000/api/v1/ping` 可达后运行：

```powershell
pnpm run self-test:gamehub
```

Expected: `SELF-TEST PASS: build, static assets, and runtime entry checks passed.`，并且真实浏览器复核无关键控制台/网络错误。

## Task 4: 提交与交付前检查

- [ ] **Step 1: 检查改动范围**

```powershell
git diff --check
git status --short
```

Expected: 只包含 `client/src/app/header/header.component.scss` 和 `scripts/verify-gamehub-client.mjs` 的实现改动；设计文档和计划文档已在本 worktree 的历史中提交，不应出现构建产物、日志或截图。

- [ ] **Step 2: 提交实现**

```powershell
git add client/src/app/header/header.component.scss scripts/verify-gamehub-client.mjs
git commit -m "修复: 对齐游戏导航弹窗和投稿按钮"
```

- [ ] **Step 3: 请求代码复核并处理阻塞问题**

复核重点：动画是否仍会覆盖自定义横向定位、两个弹窗箭头是否跟随 action wrapper 中心、投稿按钮原有状态是否保持、窄屏是否出现横向溢出。Critical/Important 问题必须在合并前修复并重新运行 Task 2-3 的验证。
