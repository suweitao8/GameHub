# GameHub B 站式首页视觉重构执行计划

## 约束

- 分支：`codex/bilibili-home-overhaul`，基于 `develop`。
- 不修改推荐服务、API schema、数据库迁移、lockfile 和用户本地配置。
- 所有客户端可见文案沿用现有 i18n 约定；本次新增结构优先复用已有文案或使用 `i18n` 属性。

## 阶段 1：契约与骨架

1. 更新 `verify-gamehub-style.mjs` 和 `verify-gamehub-client.mjs` 的首页视觉契约：要求 banner、category rail、媒体 overlay、placeholder art、lead + 3 列 side rail、透明顶部 header/滚动白底状态；删除与新目标冲突的“12 列 + 2 列 side rail”和“巨型首字母占位”断言。
2. 先运行两个静态验证，确认新契约因生产代码尚未改变而 RED。
3. 在首页模板中新增仅首页发现态使用的 banner 和分类 rail，保留社区、分类目录、搜索、following 等分支行为。

## 阶段 2：媒体卡和推荐区

1. 在 `game-card.component.html/scss` 中新增统一的图片底部 `.game-cover-meta`，并将无封面状态改为场景图兜底。
2. 将 featured carousel 改成主 lead + 3 列 × 2 行 side rail；删除 side rail 的横向卡片覆盖规则。
3. 将 lead 标题/作者/播放/评论信息收进媒体 overlay，同时保留轮播控制和可访问性。
4. 同步 `game-section.component.ts` 的内联网格/标题样式，确保普通区块与首页卡片使用同一密度。

## 阶段 3：全局 shell 和发现页

1. 更新 token、首页 layout、频道 rail 和 responsive 断点。
2. 更新 GameHub header 的 top transparent/scrolled white 状态；不触碰现有 header 滚动信号与搜索行为。
3. 对排行榜、标签、动态和创作者主页做轻量 shell 收敛，去除与首页冲突的厚重白卡和多彩表达；不改数据及路由。

## 阶段 4：验证和交付

1. 运行相关静态契约、`pnpm run build:client:light`、客户端 TypeScript/SCSS lint。
2. 使用任务 worktree 启动独立客户端预览端口，使用 Codex 内置浏览器验收 `/games` 及关键子页面；检查搜索焦点/Escape、轮播按钮/dots/触摸、键盘 focus、无横向溢出。
3. 运行 `pnpm run self-test:gamehub` 全门禁；如 Windows shell 触发脚本兼容问题，按仓库规则使用其 Windows-native fallback，并记录证据。
4. 提交前执行 `git diff --check`、提交签名、请求代码审查 skill；再快进合并到 `develop`、推送 `origin/develop`、刷新主工作区构建以验收 9000。
5. 停止本轮启动的任务预览服务，删除本轮 worktree 和分支，执行最终本地/远程 SHA、worktree 和服务状态检查。

## 风险与回滚

- 无封面数据是当前线上真实状态，因此兜底图是必要产品行为，不是测试专用样式。
- 顶部透明 header 只在未滚动的游戏首页生效；已有 `game-header-scrolled` 逻辑继续提供白色 header，避免长页面滚动后内容与导航对比不足。
- 若某一子页面的内联模板无法在本轮完全收敛，只保留 token/布局兼容，不改变其业务结构；首页媒体骨架和搜索重叠修复仍是交付核心。
