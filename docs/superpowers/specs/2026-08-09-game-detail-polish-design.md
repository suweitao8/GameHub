# 游戏详情页界面优化设计

## 背景

当前 GameHub 游戏详情页已经具备试玩、互动、评论、讨论群和相关推荐等能力，但页面视觉层级偏平：标题和开发者信息的优先级不够明确，试玩 iframe 失败时会留下大面积无信息的灰色区域，底部控制条对键盘用户和移动端用户不够友好，右侧社区与推荐内容的密度也不稳定。

本次以当前 `/games/:uuid` 详情页为第一阶段，采用“试玩、内容、社区均衡”的方向（B 方案），不改变现有 API、路由或数据模型。

## 目标

1. 让用户在进入页面后能快速理解“这是什么游戏、由谁创作、现在能否试玩”。
2. 让试玩区具备明确的加载、可用、失败和重试状态，失败时不影响页面其它内容。
3. 让点赞、投币、收藏、分享、简介/操作切换等现有操作拥有清晰的视觉反馈和可访问名称。
4. 让右侧讨论群、开发者其它游戏和同类型推荐形成稳定的辅助层级，不抢主内容焦点。
5. 在 980px 和 600px 两个关键宽度下保持可操作、无横向溢出，并保留现有触摸目标和 focus ring。

## 非目标

- 不修改游戏运行 iframe 的服务端地址、沙箱权限或游戏 API。
- 不增加第三方依赖，不引入新的全局状态库，不重做游戏首页。
- 不修改已有迁移、OpenAPI 或生成的 locale 文件。
- 不把试玩失败伪装成成功；只改善反馈和恢复路径。

## 设计

### 1. 页面层级

详情页使用浅灰页面背景和白色内容表面，标题区、试玩区、互动区和侧栏保持统一的边框/圆角/间距 token。标题区分为左侧标题与统计、右侧开发者身份与关注操作；主内容按以下顺序排列：

```text
标题与状态
  → 试玩舞台（加载 / 就绪 / 运行 / 失败）
  → 互动操作与简介/操作标签
  → 评论

侧栏：讨论群（固定高度） → 开发者其它游戏 → 同类型推荐
```

试玩舞台维持当前宽屏比例，不再让 iframe 错误导致整页进入错误态。错误提示覆盖在舞台内部，提供“重新连接”，并保留标题、互动和评论。

### 2. 试玩状态

API 加载错误继续使用页面级 `loadingError`。新增独立的 `frameError`，只由 iframe 加载错误驱动。状态行为如下：

- `frameLoading=true`：保留舞台骨架和底部进度条，隐藏开始按钮。
- `frameLoading=false && frameError=false && gameStarted=false`：显示“开始游戏”主按钮。
- `gameStarted=true`：显示“正在游玩”，控制条可通过 hover、focus 或键盘访问。
- `frameError=true`：显示明确错误文案、错误图标和“重新连接”按钮；按钮调用现有 reload 逻辑并清除旧错误。

错误状态使用 `role="alert"`，运行状态使用 `aria-live="polite"`。`Space`、`R`、`F` 快捷键保留，且不劫持输入框操作。

### 3. 操作和可访问性

- 主要试玩按钮保持可见且不依赖 hover。
- 控制条按钮继续有显式 `aria-label`，音量滑杆保持原生 range 语义。
- 操作反馈使用 `role="status"`，请求进行时维持禁用态，避免重复提交。
- 互动 tab 补充 `aria-controls` 与稳定 panel 标识，键盘焦点保留在触发 tab 上。
- 所有新增动画在 `prefers-reduced-motion: reduce` 下关闭或缩短。

### 4. 响应式

- 大于 980px：主内容与侧栏使用 4fr/1fr 的双列布局，侧栏从标题区下方开始对齐。
- 600px–980px：改为单列，侧栏自然落在评论之后；试玩舞台高度使用视口宽度约束。
- 小于 600px：标题、开发者卡片和控制条允许换行；按钮和输入保持至少 44px 触摸高度；错误卡片不遮蔽整个舞台。

## 涉及文件

- `client/src/app/+games/game-play.component.html`：新增试玩失败状态、状态文案和 tab 关联属性。
- `client/src/app/+games/game-play.component.ts`：拆分 iframe 错误状态，重试时清理状态。
- `client/src/app/+games/game-play/_layout.scss`：页面表面、标题区、网格和侧栏层级。
- `client/src/app/+games/game-play/_runtime-frame.scss`：试玩舞台、错误卡片、控制条和 reduced-motion。
- `client/src/app/+games/game-play/_game-info.scss`：详情页标题、评论和父层信息区的视觉一致性。
- `client/src/app/+games/game-community-panel.component.scss`：互动操作、tab、描述面板的视觉一致性。
- `scripts/verify-gamehub-client.mjs`：增加游戏详情页状态与可访问性结构契约。

## 验证

1. 先运行新增结构契约，确认它在旧实现上按预期失败。
2. 实现后运行 `node scripts/verify-gamehub-client.mjs`。
3. 运行变更文件 ESLint/Stylelint 与 `pnpm run build:client:light`。
4. 运行 `pnpm run self-test:gamehub`，不使用跳过参数作为最终结果。
5. 在运行中的 GameHub 上用浏览器检查详情页：桌面 1440px、平板 900px、移动 390px；覆盖加载/失败/重试、开始游戏、音量、全屏、互动按钮、简介/操作 tab 和评论输入。
