# GameHub 需求规格与全栈重构计划

> 生成日期：2026-07-29
> 基线分支：develop（a6abf5e77）
> 范围：全栈整体重构（前端 + 后端 + 类型层）
> 工作方式：worktree 隔离开发，分阶段合并回 develop

---

## 第一部分：需求规格（PRD）

### 1.1 产品定位

GameHub 是基于 PeerTube 联邦化视频平台改造的 **HTML5 小游戏社区**，对标 B 站游戏区，核心价值：

- **即点即玩**：纯 HTML 单文件沙箱运行，无需下载安装
- **社区互动**：点赞/投币/收藏/评论/关注，完整创作者生态
- **联邦化**：基于 ActivityPub，游戏可跨实例传播（B 站不具备）
- **自托管**：任何人可部署独立实例，去中心化审核

### 1.2 现有功能全景（已实现）

基于代码扫描，当前共实现 **8 大领域、40+ API、22 条前端路由**。

#### 1.2.1 游戏核心（CRUD + 运行）

| 功能 | 前端路由 | 后端 API | 数据模型 |
|------|---------|---------|---------|
| 游戏发现首页 | `/games` | `GET /api/v1/games` | GameModel |
| 游戏详情/运行 | `/games/:uuid` | `GET /:uuid`, `POST /:uuid/play` | GameModel |
| 上传游戏 | `/games/upload` | `POST /` | GameModel + runtime |
| 编辑游戏 | `/games/edit/:uuid` | `PUT /:uuid` | GameModel |
| 删除游戏 | — | `DELETE /:uuid` | GameModel |
| HTML 沙箱运行 | — | `/:uuid/runtime/` | game-runtime.ts |
| 封面/截图 | — | `/:uuid/cover`, screenshots | game-cdn.ts |
| 运行时预览 | — | `/preview` | game-runtime-preview.ts |

#### 1.2.2 社区互动

| 功能 | API | 数据模型 |
|------|-----|---------|
| 点赞 | `PUT /:uuid/rate` | GameRatingModel |
| 收藏 | `PUT /:uuid/favorite` | GameFavoriteModel |
| 关注作者 | `PUT /author/:accountId/follow` | ActorFollowModel |
| 投币（1/2 枚） | `POST /:uuid/coin` | GameCoinLedgerModel |
| 一键三连 | `POST /:uuid/triple` | 组合操作 |
| 评论 + 多级回复 | `POST /:uuid/comments`, `/:commentId/reply` | GameCommentModel |
| 评论点赞 | `PUT /:uuid/comments/:commentId/like` | GameCommentReactionModel |
| 评分/评价 | `PUT /:uuid/review` | GameReviewModel |
| 分享（短链） | `POST /:uuid/share`, `GET /s/:token` | game-share.ts |
| 举报 | `POST /:uuid/report` | GameReportModel |

#### 1.2.3 个人中心（me/*）

| 功能 | 前端路由 | 后端 API |
|------|---------|---------|
| 我的游戏库 | `/games/library` | `GET /me/favorites`, `/me/recent`, `/me/owned` |
| 通知中心 | `/games/notifications` | `GET /me/notifications` + 已读/删除 |
| 关注列表 | `/games/following` | `GET /me/following` |
| 稍后再玩 | `/games/watch-later` | 前端 localStorage（无后端） |
| 我的预约 | `/games/reservations` | `GET /me/reservations` |
| 用户等级 | — | `GET /me/level`, `POST /me/level/daily-login` |

#### 1.2.4 发现与排行

| 功能 | 前端路由 | 后端 API |
|------|---------|---------|
| 排行榜（7 维度+分类筛选） | `/games/rankings` | `GET /rankings` |
| 热门标签云 | `/games/tags` | `GET /tags` |
| 精选游戏 | 首页 | `GET /featured` |
| 专题合集 | `/games/collections` | `GET /collections`, `/collections/:slug` |
| 推荐游戏 | 首页"猜你喜欢" | `GET /me/recommendations` |
| 搜索建议 | 导航栏 | `GET /suggest` |
| 社区动态 Feed | `/games/activity` | `GET /feed`, `/feed/public` |

#### 1.2.5 创作者

| 功能 | 前端路由 | 后端 API |
|------|---------|---------|
| 创作中心 | `/games/creator` | `GET /me/overview` |
| 数据分析 | `/games/analytics` | `GET /me/analytics`（趋势/互动/排行/粉丝） |
| 作者空间 | `/games/author/:accountId` | `GET /author/:accountId` |

#### 1.2.6 活动与内容

| 功能 | 前端路由 | 后端 API |
|------|---------|---------|
| 活动列表 | `/games/events` | `GET /events` |
| 活动详情 | `/games/event/:slug` | `GET /events/:slug` |
| 活动管理 | `/games/event-admin` | admin API |
| 攻略专栏 | `/games/articles` | — |
| 游戏预约 | 详情页按钮 | `POST /:uuid/reserve` |

#### 1.2.7 管理

| 功能 | 前端路由 | 后端 API |
|------|---------|---------|
| 游戏审核 | `/games/manage` | `GET /admin`, `POST /:uuid/moderate` |
| 精选管理 | — | `PUT /:uuid/featured` |

#### 1.2.8 横切关注点

| 能力 | 实现 |
|------|------|
| 每日硬币发放 | GameCoinLedgerModel daily_grant |
| 经验值/等级 | game-exp.ts（LV0-6） |
| 通知去重+重试 | game-notifications.ts |
| API 缓存 | Redis cacheRoute() |
| CDN 签名 URL | game-cdn.ts |
| 统计物化视图 | GameStatsSummaryModel + Scheduler |
| 协同过滤推荐 | game-recommendations.ts |
| OpenTelemetry | game-tracing.ts |
| CSP 沙箱安全 | game-runtime.ts（SHA256 + 禁外连） |

### 1.3 对标 B 站差距矩阵

| 领域 | B 站 | GameHub | 差距等级 |
|------|------|---------|---------|
| 游戏运行 | APK/云游戏/H5/Toy | HTML 单文件 | ⚠️ 仅 HTML |
| 弹幕 | 实时评论飘屏 | 无 | ❌ 缺失 |
| 表情评论 | emoji 选择器 | 纯文本 | ⚠️ 缺表情 |
| 多收藏夹 | 用户自建分类 | 单一收藏 | ⚠️ 缺失 |
| 播放历史 | 进度记录 | 仅最近列表 | ⚠️ 部分 |
| 攻略/WIKI | 玩家贡献百科 | 空壳专栏页 | ❌ 缺失 |
| 开发者平台 | SDK/文档/支付 | 无 | ❌ 缺失 |
| 收益中心 | 创作者激励 | 无 | ❌ 缺失 |
| 大会员 | 付费会员特权 | 无 | ❌ 缺失 |
| 活动/赛事 | 运营活动系统 | 基础活动 CRUD | ⚠️ 部分 |

**结论**：核心互动链路（发现→游玩→互动→创作）已对齐 B 站；差距集中在**内容生态**（攻略/WIKI/弹幕）和**商业化**（支付/广告/会员），属于长期演进项，不阻塞当前重构。

---

## 第二部分：技术债清单（基于代码扫描）

### 2.1 🔴 严重 — 巨型文件（God Object）

| 文件 | 行数 | 问题 | 影响 |
|------|------|------|------|
| `server/.../games/index.ts` | **1407** | 40 条路由 + 全部 handler 混在一个文件，涵盖 8 个领域 | 难维护、合并冲突高发 |
| `server/.../games/community.ts` | **908** | 18 条社区路由 + 全部业务逻辑 | 同上 |
| `client/+games/game-play.component.ts` | **908** | 单组件承担 10+ 职责（运行+评论+评分+收藏+投币+分享+举报+截图灯箱+meta+种子评论） | 无法独立测试、修改风险高 |
| `client/+games/game-play.component.scss` | **~1400** | 单文件样式过大 | 同上 |
| `client/+games/games-home.component.ts` | **550** | 首页承担发现+搜索+分类+社区+专题多模式 | 职责过载 |
| `client/+games/games.service.ts` | **466** | God Service，40+ 方法覆盖 11 个领域 | 单点依赖、难拆分 |
| `client/+games/game-analytics-dashboard.component.ts` | **599** | 数据看板单文件含图表+数据+交互 | 可拆 |

### 2.2 🔴 严重 — 类型定义断裂

**现状**：`packages/models/` 下**零个 game 相关类型**。客户端 `games.service.ts` 手写了 15+ 个 interface（Game/GameList/GameCommunity/GameComment/GameReview/GameNotification/GameRanking/GameLevelInfo/GameAnalytics 等），与后端 API 契约完全脱节。

**风险**：
- 后端改字段，前端无编译期感知
- 无法生成 OpenAPI 客户端
- 类型与实际 API 响应可能已漂移

### 2.3 🟡 中等 — 重复代码模式

**loading/error/empty 三态管理**：以下 7+ 组件各自重复实现 `loading = signal()` / `error = signal()` / 手动 set：

- game-rankings、game-library、game-author、game-following、game-events、game-articles、game-collections、game-collection-detail、game-activity-feed

每个都重复写：`this.loading.set(true)` → `subscribe` → `next: loading.set(false)` / `error: loading.set(false); error.set(true)`。

**应抽取**为统一的 `AsyncState<T>` 信号工具或 `useAsyncResource()` 指令。

### 2.4 🟡 中等 — 后端控制器未分领域

`index.ts` 把以下领域全混在一起：
- 游戏 CRUD（list/get/create/update/delete）
- 用户个人（me/favorites、me/recent、me/owned、me/overview、me/level、me/notifications）
- 发现（rankings、tags、categories、featured、suggest、feed）
- 预约（reserve/cancel/listReservations）
- 合集（collections）
- 分享（share/resolveShare）
- 举报（report）
- 审核（moderate、admin、featured）

应按领域拆分为独立 router 文件。

### 2.5 🟢 轻微 — 其他

| 问题 | 说明 |
|------|------|
| `game-play.component.ts` 种子评论 `buildSeedComments` | 第 644-717 行硬编码假评论数据，应移除或改为配置 |
| 前端组件 SCSS 超 budget 警告 | 多个组件 SCSS 超 6KB budget，构建告警（非阻塞） |
| 无单元测试/E2E | games 模块零测试覆盖 |
| `*ngFor` 残留风险 | launch-report 称已清零，但需持续守护 |

---

## 第三部分：重构计划

### 3.0 重构原则

1. **行为不变**：重构不改用户可见功能和 API 契约，每个阶段结束后 `build:server` + `build:client` 必须通过
2. **小步快跑**：每个阶段独立可合并，单阶段不超过 1 个工作日
3. **验证先行**：每个阶段产出验证证据（编译通过 + 关键页面 200 + API 抽样）
4. **worktree 隔离**：每阶段建独立 worktree，合并回 develop 后删除

### 3.1 阶段一：类型层统一（基础设施，最高优先级）

**目标**：建立前后端共享的类型契约，消除手写 interface。

**产出**：
- 新建 `packages/models/src/games/` 目录，定义所有 game 相关 TypeScript 接口
- 按领域分文件：`game.model.ts`、`community.model.ts`、`creator.model.ts`、`notification.model.ts`、`ranking.model.ts`、`analytics.model.ts`
- 从后端 controller 实际返回值反推字段，确保与 API 真实一致（不是凭记忆）
- 客户端 `games.service.ts` 改为从 `@peertube/peertube-types` 导入，删除手写 interface
- 导出加入 `packages/models/src/index.ts`

**验证**：
- `node ./node_modules/typescript/bin/tsc -b server/tsconfig.json` 通过
- `ng build` 通过
- 前端页面正常渲染

**预估**：1 天

### 3.2 阶段二：后端控制器分领域拆分

**目标**：把 `index.ts`（1407 行）拆成领域内聚的小文件。

**目标结构**：
```
server/core/controllers/api/games/
├── index.ts              # 仅做 router 聚合 + export（<50 行）
├── game-crud.ts          # list/get/create/update/delete/download/preview（~300 行）
├── game-discovery.ts     # rankings/tags/categories/featured/suggest/feed（~250 行）
├── game-personal.ts      # me/favorites、me/recent、me/owned、me/overview、me/following（~200 行）
├── game-reservation.ts   # reserve/cancel/listReservations（~80 行）
├── game-collection.ts    # collections list/detail（~80 行）
├── game-moderation.ts    # admin/moderate/featured/report（~150 行）
├── game-share.ts         # share/resolveShare（~50 行）
├── community.ts          # 保持（已较内聚，可进一步拆评论/评分/关注）
├── events.ts             # 保持
└── runtime.ts            # 保持
```

**原则**：
- 纯文件拆分 + 移动，不改业务逻辑
- 每个 handler 函数原样搬迁，只改 import 路径
- `index.ts` 只负责 `gamesRouter.use()` 聚合各子 router

**验证**：
- `build:server` 通过
- 所有 API 路径行为不变（抽样 curl 验证关键端点）
- OpenAPI spec 校验通过（如涉及）

**预估**：1 天

### 3.3 阶段三：前端 God Service 拆分

**目标**：把 `games.service.ts`（466 行 / 40+ 方法）按领域拆分。

**目标结构**：
```
client/src/app/+games/services/
├── games.service.ts          # 仅保留 list/get/create/update/delete + 缓存逻辑
├── game-community.service.ts # comments/reviews/rate/favorite/follow/coin/triple/related
├── game-personal.service.ts  # me/favorites、me/recent、me/owned、me/notifications
├── game-discovery.service.ts # rankings/tags/featured/suggest/feed/collections
├── game-creator.service.ts   # overview/analytics/author
├── game-reservation.service.ts
└── game.types.ts             # 从 packages/models 重导出（如需前端专用扩展）
```

**原则**：
- 各组件按需 inject 对应领域 service，不再全量依赖 GamesService
- 缓存逻辑（listCache/detailCache）保留在基础 games.service.ts
- 不改 HTTP 调用 URL 和参数

**验证**：`ng build` 通过 + 前端页面功能抽样

**预估**：1 天

### 3.4 阶段四：game-play 组件拆分

**目标**：把 908 行的 `game-play.component.ts` 拆成子组件/指令。

**拆分方案**：
```
client/src/app/+games/game-play/
├── game-play.component.ts          # 容器组件：路由参数、游戏加载、布局编排（<200 行）
├── game-player.component.ts        # iframe 运行 + 音量控制 + 截图轮播
├── game-actions.component.ts       # 点赞/收藏/关注/投币/三连/分享 按钮组
├── game-comments.component.ts      # 评论列表 + 发表 + 回复 + 点赞 + 删除
├── game-reviews.component.ts       # 评价区（评分分布 + 评价列表）
├── game-screenshots.component.ts   # 截图灯箱（lightbox）
├── game-report-dialog.component.ts # 举报弹窗
├── game-share-dialog.component.ts  # 分享弹窗
└── game-meta-tags.service.ts       # SEO meta tags 注入（纯函数化）
```

**删除项**：
- 移除 `buildSeedComments` / `buildSeedReplies`（第 644-717 行硬编码假评论）

**原则**：
- 容器组件通过 `@Input()`/`@Output()` 或 signal 传递数据给子组件
- 子组件独立可测
- 模板（html）和样式（scss）同步拆分

**验证**：`ng build` 通过 + 详情页完整功能手动验证（运行/评论/点赞/收藏/投币/分享/举报/截图）

**预估**：2 天（最复杂阶段）

### 3.5 阶段五：games-home 组件拆分 + 公共状态工具

**目标**：
1. 拆分 `games-home.component.ts`（550 行）的发现/搜索/分类/社区多模式
2. 抽取公共 `AsyncState` 工具消除三态重复代码

**拆分方案**：
```
client/src/app/+games/games-home/
├── games-home.component.ts        # 容器：根据路由模式分发
├── game-discovery-view.component.ts  # 默认发现页（轮播+精选+排行+分类）
├── game-search-view.component.ts     # 搜索结果页
├── game-community-view.component.ts  # 社区页
└── game-category-view.component.ts   # 分类目录页
```

**公共工具**：
```
client/src/app/+games/shared/
├── async-state.ts          # createAsyncState<T>() → { data, loading, error, reload }
├── game-loading-skeleton.component.ts  # 统一骨架屏
├── game-error-retry.component.ts       # 统一错误重试
└── game-empty-state.component.ts       # 统一空状态
```

**预估**：1.5 天

### 3.6 阶段六（可选）：测试基建

**目标**：为重构后的核心逻辑建立测试守护。

- 后端：为拆分后的 controller handler 写 Mocha 集成测试（参照 packages/tests 现有模式）
- 前端：为公共 `AsyncState` 工具和核心 service 写单测
- E2E：关键路径（发现→详情→评论→点赞）Playwright 冒烟

**预估**：2 天（可延后）

### 3.7 阶段总览

| 阶段 | 内容 | 预估 | 风险 | 依赖 |
|------|------|------|------|------|
| 一 | 类型层统一 | 1 天 | 低（纯类型） | 无 |
| 二 | 后端控制器拆分 | 1 天 | 低（纯移动） | 无 |
| 三 | 前端 Service 拆分 | 1 天 | 中（影响全组件） | 阶段一 |
| 四 | game-play 拆分 | 2 天 | 高（最复杂页面） | 阶段三 |
| 五 | games-home 拆分 + 公共工具 | 1.5 天 | 中 | 阶段三 |
| 六 | 测试基建（可选） | 2 天 | 低 | 一~五 |

**总预估**：核心阶段（一~五）约 6.5 天；含测试约 8.5 天。

---

## 第四部分：验收标准

每个阶段合并前必须满足：

- [ ] 对应 `build`（server 和/或 client）通过
- [ ] 改动文件 `git diff --check` 无空白错误
- [ ] 关键 API/页面抽样验证（curl 200 + 浏览器渲染）
- [ ] 提交信息中文，符合 `type(scope): 描述` 格式
- [ ] 合并到 develop 并推送 origin/develop
- [ ] worktree 清理完毕

整体重构完成的验收：
- [ ] `packages/models/src/games/` 存在且被前后端引用
- [ ] `server/.../games/index.ts` < 100 行（仅聚合）
- [ ] `client/+games/games.service.ts` < 150 行（仅基础 CRUD + 缓存）
- [ ] `client/+games/game-play.component.ts` < 250 行
- [ ] 无单文件超过 600 行（前端 ts / 后端 ts）
- [ ] 公共 `AsyncState` 工具被至少 5 个组件复用
- [ ] `build:server` + `build:client` 全通过
- [ ] 所有原有 API 路径和前端路由行为不变

---

## 第五部分：风险与回滚

| 风险 | 缓解 |
|------|------|
| 拆分引入隐蔽 bug | 每阶段小步合并 + 行为不变原则 + 关键路径验证 |
| 类型统一暴露 API 契约漂移 | 阶段一以实际 API 返回为准，发现漂移单独修复 |
| 前端 service 拆分影响面广 | 阶段三优先，完成后全量回归验证 |
| game-play 拆分最易出错 | 阶段四放最后，拆分时保持模板结构可对比 |
| worktree 并发冲突 | 严格串行，每阶段合并后再开下一阶段 |

**回滚策略**：每阶段独立 commit + 独立 worktree 分支，发现问题可直接 revert 单阶段。

---

*文档由代码扫描 + 现有需求文档整合生成，作为重构基线。实施时如发现实际与文档不符，以代码为准并即时更新本文档。*
