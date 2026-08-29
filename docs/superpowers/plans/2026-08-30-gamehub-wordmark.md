# GameHub 字标与 G 图标实现计划

## 目标

以现有 GameHub 设计令牌中的电光靛蓝 `#5044e4` 为品牌色，交付横向 `GameHub` 页头字标和独立 `G` favicon，并保持现有自定义实例 Logo fallback 行为。

## 实施步骤

1. 新增横向 `gamehub-wordmark.svg`，并将 `gamehub-logo.svg`、`gamehub-favicon.svg`、`logo.svg` 统一为扁平靛蓝 G 图标。
2. 更新游戏体验页头和移动端菜单，使用横向字标；修正响应式规则，窄屏不再隐藏字标。
3. 更新 favicon 查询版本与服务端 `header-wide` 默认 Logo；保留 `header-square` 使用 G 图标。
4. 扩展 `scripts/verify-gamehub-client.mjs`，把两类品牌资源、引用、颜色和旧彩虹实现纳入静态契约。
5. 安装隔离 worktree 依赖，执行轻量构建/客户端变更 lint/静态契约；启动独立端口服务，用 Codex 内置浏览器做桌面、窄屏与菜单打开验收。
6. 更新发布说明，提交签名 commit，合并到 `develop`，推送 `origin/develop`，只清理本任务 worktree，并完成本地/远程一致性检查。

## 风险与处理

- 主工作区存在其他任务的未完成合并改动：本任务只在隔离 worktree 操作，合并时保留双方修改。
- 服务端默认 `header-wide` 与方形 Logo 的宽高契约不同：横向字标使用实际 viewBox 比例，方形 fallback 继续使用 34px 图标。
- 用户明确要求内置浏览器：验收只使用 Codex in-app browser，不使用 Chrome 或 Playwright CLI。
