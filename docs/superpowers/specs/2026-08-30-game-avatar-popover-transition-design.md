# GameHub 头像到个人资料卡的 B 站式转场设计

## 背景

当前 GameHub 顶栏的已登录用户入口由一个 34px 头像按钮和一个资料悬停卡组成。悬停卡内部又渲染了一张 4.6rem 头像，所以用户从顶栏头像移动到资料卡时会同时看到两张头像，且两张头像之间没有连续的空间关系。参考 B 站的个人菜单交互，顶栏头像应当成为资料卡顶部居中的头像视觉对象：它从原位置放大并移动到资料卡上沿，资料卡只承载名称、硬币和操作内容。

## 目标

- 桌面端鼠标悬停时，顶栏头像本身平滑放大并移动到资料卡顶部中心。
- 键盘聚焦与鼠标悬停复用同一转场状态，不产生第二套焦点行为。
- 资料卡 DOM 中不再渲染重复头像，整个转场只使用一个 `.game-user-avatar` 元素。
- 头像的最终视觉中心与资料卡水平中心一致，并覆盖在资料卡上沿之上，形成连续的 B 站式层次关系。
- 鼠标从头像滑入资料卡时保持打开，离开后头像回到顶栏原位，资料卡继续沿用现有延迟淡出和卸载逻辑。
- 移动端保留现有点击头像进入个人主页的行为，不强行播放桌面跨位置转场。
- 支持 `prefers-reduced-motion`：不播放过渡，但打开状态仍显示在最终位置，信息层级不改变。

## 非目标

- 不改变头像点击后的路由、登录态、硬币余额请求或退出登录逻辑。
- 不改变动态、收藏、历史和创作中心的其他弹窗。
- 不引入 Angular CDK、动画库、Portal 或新的运行时依赖。
- 不把头像真实移动到资料卡 DOM 内；通过同一图片元素的 GPU transform 实现视觉转场，避免 DOM 重排和重复资源加载。

## 设计

### 单一头像视觉对象

模板保留现有 `.game-user-avatar` 图片，并在 `.logged-in-container` 上绑定 `game-avatar-menu-open` class。该 class 直接来自已经存在的 `isOpenPopover('avatar')` 状态。资料卡的 `.game-avatar-profile` 删除 `.game-avatar-hover-avatar` 图片，只保留名称和硬币信息，并用顶部内边距给转场后的头像预留内容空间。

这样打开过程只有一张图片：它仍然是按钮的子节点，但通过 `transform` 跨过 Header 与资料卡之间的间隙，视觉上停在资料卡上沿中心。按钮设置相对定位和更高层级，资料卡作为背景层，确保放大的头像覆盖在资料卡上方且不影响资料卡按钮点击。

### 转场几何

GameHub 桌面 Header 的高度由 `--header-height` 提供，资料卡距 Header 下沿为 `0.5rem`。资料卡右边缘与头像容器右边缘对齐，默认头像按钮为 40px、资料卡为 300px，因此打开态同时使用固定的水平居中修正和纵向位移：

```css
translate3d(calc((40px - 300px) / 2), calc(var(--header-height) / 2 + 0.5rem), 0)
```

该位移会把头像中心落到资料卡上沿和水平中心，同时让资料卡右边缘保持在头像容器右边缘，避免顶栏靠近视口右侧时卡片被截断。头像通过 `scale(2.12)` 从 34px 放大到约 72px，与资料卡 300px 宽度及现有资料信息比例匹配。`transform-origin: center` 保证缩放前后中心点稳定，`will-change: transform` 只提示浏览器为该短时转场准备合成层，不改变布局尺寸。

打开态同时使用 `scale` 与 `translate3d`，持续时间使用现有 `--game-dur-slow`，让头像先快速放大、再顺滑落到资料卡上沿；关闭时同一属性反向过渡回按钮位置。资料卡仍按现有 `opacity` 和延迟卸载逻辑处理，头像回位不会等待资料卡卸载。

### 交互与状态

1. `pointerenter` 或 `focusin` 触发 `setPopoverOpen('avatar', true)`；资料卡挂载，包装器获得 `game-avatar-menu-open`，头像开始转场。
2. 鼠标经过放大的头像进入资料卡时，事件仍发生在同一个 `.logged-in-container` 内；现有 hover bridge 和延迟关闭逻辑保持资料卡可操作。
3. 鼠标离开整个包装器或焦点离开包装器时，打开态 class 立即移除，头像回到原位；资料卡按既有宽限期淡出并卸载。
4. 点击头像仍调用 `openGameProfile($event)`，维持当前进入作者主页的行为。
5. `$mobile-view` 以下不设置跨 Header 的 transform；移动端继续依赖点击进入个人主页，触控场景不会因为 hover 视觉状态造成布局跳动。

### 可访问性与视觉一致性

- 保留头像按钮的 `aria-haspopup="dialog"`、`aria-expanded`、可见 focus ring 和原有个人信息 `role="dialog"`。
- 唯一头像继续保留真实用户名称的 `alt`；资料卡内不添加第二张装饰图片，也不产生重复读屏内容。
- `prefers-reduced-motion: reduce` 下将头像和资料卡过渡置为 `none`，但保持打开态的最终几何位置。
- 头像、资料卡、边框和阴影继续使用现有 GameHub token，不新增硬编码颜色或圆角。

## 实现范围

- `client/src/app/header/header.component.html`：给已登录 GameHub 头像容器绑定打开态 class，移除资料卡内重复头像。
- `client/src/app/header/header.component.scss`：实现单头像的放大/位移、卡片右边缘约束、层级、资料信息留白、移动端和 reduced-motion 规则。
- `scripts/verify-gamehub-client.mjs`：增加回归契约，验证唯一头像、状态 class、最终 transform、资料卡留白和无重复图片。
- `docs/superpowers/plans/2026-08-30-game-avatar-popover-transition-plan.md`：记录 TDD、构建、浏览器验收和交付步骤。

## 验收标准

- 已登录桌面端悬停头像时，DOM 中只有一张 `.game-user-avatar`，其计算尺寸约为 72px，资料卡内没有 `.game-avatar-hover-avatar`。
- 打开态头像中心与资料卡中心的水平误差不超过 2px，头像中心纵向落在资料卡上沿附近；关闭后恢复 34px 原位。
- 鼠标可以从头像移动到资料卡并点击退出登录，卡片不会因为经过间隙立即消失。
- 键盘 Tab 聚焦头像会打开同一资料卡和同一头像转场，焦点轮廓保持可见；移出焦点后状态收回。
- 窄屏和移动端不出现横向滚动；移动端点击头像仍能进入原有个人主页路由。
- 现有 GameHub 样式检查、变更文件 Stylelint、轻量构建和真实浏览器回归通过。

## 验证策略

1. 先让静态回归契约验证当前实现失败，证明契约确实捕获了“资料卡内重复头像”和“没有单头像转场”的缺口。
2. 只修改 Header 模板和 SCSS 使契约变绿，再运行变更文件 Stylelint。
3. 执行 `pnpm run verify:gamehub-client`、`pnpm --dir client run lint-scss` 和 GameHub 自检门禁。
4. 使用真实 Chrome 检查桌面 hover、键盘 focus、离开回位、资料卡按钮可点击、窄屏和移动端；通过 `getBoundingClientRect()` 对比唯一头像与资料卡中心，而不是只看截图。
