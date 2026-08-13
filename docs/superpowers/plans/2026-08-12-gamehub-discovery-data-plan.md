# GameHub 合集与活动可信数据 Implementation Plan

**Goal:** 让合集数量、活动报名状态和报名人数全部来自准确、可并发安全的后端数据。

## Task 1: 先固定失败的回归契约

- [ ] 扩展 `scripts/verify-gamehub-client.mjs`，要求真实合集计数、共享模型一致性、专用活动参与状态接口、容量检查和事务锁。
- [ ] 运行 `pnpm run verify:gamehub-client`，确认基线因当前硬编码/扫描前 100 人而失败。

## Task 2: 修复合集 API 与共享模型

- [ ] 为合集列表增加已发布游戏聚合计数和分页总数。
- [ ] 详情查询仅包含已发布游戏，并返回与列表一致的元数据与 `gameCount`。
- [ ] 对齐 `GameCollection`、`GameCollectionDetail` 共享模型，并删除 Angular 中的重复类型和强制转换。

## Task 3: 完整化活动报名状态机

- [ ] 增加认证的 `GET /events/:slug/participation`；公共详情保持缓存安全。
- [ ] 在锁定活动记录的事务中实现加入、满额拒绝、重复拒绝、退出及精确人数响应。
- [ ] 前端以专用状态接口和 mutation 返回值更新 UI，未登录时回跳登录，错误信息保留可操作原因。
- [ ] 统一 `GameEvent`、参与状态和 mutation 返回的共享模型；修订 OpenAPI。

## Task 4: 验证与收尾

- [ ] 先运行回归契约 RED，再实现 GREEN。
- [ ] 运行针对性测试、客户端 lint/构建、服务端构建、OpenAPI 校验和完整 `self-test:gamehub`。
- [ ] 用真实浏览器验证投稿回跳及活动页面的未登录报名回跳；仅在所有检查成功后提交、合并、推送和清理当前 worktree。
