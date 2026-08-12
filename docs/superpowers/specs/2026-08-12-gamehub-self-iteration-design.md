# GameHub 前端契约自洽与动效可访问性设计

## 背景

当前 `pnpm run verify:gamehub-client` 有 5 项失败。对照最近提交可以确认：

- 轮播页脚已经改为深蓝灰纯色，验证脚本仍要求旧棕色；
- 轮播渐隐已经改为 15% 的单色线性渐变，脚本仍要求旧的 10%；
- “换一批”已经改为逐字竖排，脚本仍锁定旧的字距；
- 顶部弹窗已经统一使用 `.game-nav-cover`，脚本仍检查已删除的 `.game-preview-cover`；
- 导航本身已经采用透明 hover/active，脚本的全局颜色匹配误把弹窗列表 hover 当成导航背景。

此外，游戏首页和游戏导航的 hover 图标动画没有响应 `prefers-reduced-motion`，对减少动态效果的用户仍会播放旋转、弹跳和淡入动画。

## 目标

1. 让验证脚本准确描述当前已经确认的 GameHub 视觉实现，避免错误地推动代码回退。
2. 保留当前轮播深蓝灰纯色页脚、15% 线性渐隐、竖排“换一批”和统一弹窗封面布局。
3. 为游戏首页换一批动作、轮播控制和游戏导航动画增加减少动态效果支持。
4. 不改变 API、路由、数据结构、上传流程和主工作区现有未提交改动。

## 实现边界

- 修改 `scripts/verify-gamehub-client.mjs` 的断言，使其检查当前选择器、尺寸、颜色和行为。
- 在 `featured-carousel.component.scss`、`game-section.component.ts`、`games-home/_sections.scss` 和 `header.component.scss` 增加减少动态效果规则。
- 不新增依赖，不修改生成文件、锁文件、数据库或服务端接口。
- 只在隔离 worktree 中提交；合并时保留主工作区的导航栏垂直居中未提交改动。

## 验证

- 先让新增的减少动态效果契约在基线上失败，确认测试确实覆盖缺口。
- 修改后运行 `pnpm run verify:gamehub-client`，确认契约全绿。
- 运行涉及文件的 SCSS/TypeScript 检查和 `pnpm run self-test:gamehub`。
- 使用真实浏览器检查游戏首页、轮播和游戏详情页的导航状态；必要时用本地可用浏览器替代已中断的内置浏览器连接，并如实记录。
