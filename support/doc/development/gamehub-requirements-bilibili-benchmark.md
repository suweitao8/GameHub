# GameHub 需求全景与 B 站对标分析

> 生成日期：2026-07-20
> 基于代码库实际扫描 + B 站游戏中心公开资料

---

## 一、项目现状总览

### 1.1 已实现功能清单

| 领域 | 功能 | 状态 | 对应代码 |
|------|------|------|----------|
| **游戏 CRUD** | 创建/编辑/删除/发布游戏 | ✅ | `games/index.ts` → createGame, updateGame, removeGame |
| **游戏运行** | HTML 单文件沙箱 iframe 运行 | ✅ | `runtime.ts`, `game-runtime.ts` |
| **安全隔离** | CSP + sandbox + 禁止外连 API + SHA256 校验 | ✅ | `game-runtime.ts` → validateInlineCode, getGameRuntimeHeaders |
| **封面图** | 上传/存储/CDN 签名 URL/ETag | ✅ | `game-cdn.ts`, `runtime.ts` → serveCover |
| **分类/标签** | category + tags 数组，支持筛选 | ✅ | `GameModel` → listPublished |
| **搜索** | 标题/描述/分类/标签模糊搜索 | ✅ | `GameModel` → listPublished (Op.iLike) |
| **排序** | 最新/热门/点赞/投币/收藏/推荐 | ✅ | `game-query.ts` → getGameSortMetric |
| **点赞** | like/none 切换 | ✅ | `community.ts` → rateGame |
| **收藏** | 收藏/取消收藏 | ✅ | `community.ts` → favoriteGame |
| **投币** | 1 或 2 枚，每日自动发放 | ✅ | `community.ts` → coinGame |
| **评论** | 多级评论 + 软删除 | ✅ | `community.ts` → addComment, replyToComment |
| **评论点赞** | 对单条评论点赞/取消 | ✅ | `community.ts` → likeComment |
| **评分/评价** | 1-5 分 + 文字评价 (upsert) | ✅ | `community.ts` → upsertReview |
| **关注作者** | ActivityPub follow 机制 | ✅ | `community.ts` → followAuthor |
| **通知系统** | 批量通知 + 去重 + 重试 | ✅ | `game-notifications.ts` |
| **通知类型** | comment/reply/like/coin/favorite/follow/moderation/system | ✅ | `GAME_NOTIFICATION_KINDS` |
| **通知管理** | 已读/全部已读 | ✅ | `index.ts` → markGameNotificationRead |
| **创作者中心** | 游戏列表/存储配额/硬币余额/统计 | ✅ | `index.ts` → getCreatorOverview |
| **作者主页** | 作者信息/游戏/关注状态 | ✅ | `index.ts` → getAuthor |
| **审核系统** | pending/published/blocked/unlisted 状态流转 | ✅ | `index.ts` → moderateGame |
| **举报系统** | 游戏/评论举报，状态管理 | ✅ | `GameReportModel` |
| **最近游玩** | 记录 + 查询 | ✅ | `GameRecentModel` |
| **每日硬币** | 每日自动发放 2 枚 | ✅ | `GameCoinLedgerModel` → daily_grant |
| **上传限速** | 每小时上传数/账号配额/文件大小 | ✅ | `CONFIG.GAMES` |
| **API 缓存** | Redis API 缓存 (列表/详情/作者) | ✅ | `cacheRoute()` |
| **CDN 缓存** | 签名 URL + Cache-Control + ETag | ✅ | `game-cdn.ts` |
| **OpenTelemetry** | 游戏端点链路追踪 | ✅ | `game-tracing.ts` |
| **统计物化视图** | 定时刷新游戏统计汇总 | ✅ | `GameStatsSummaryModel` + `GameStatsSummaryScheduler` |
| **协同过滤推荐** | 余弦相似度用户-游戏推荐 | ✅ | `game-recommendations.ts` |
| **前端首页** | 游戏发现/搜索/分类/横幅 | ✅ | `GamesHomeComponent` |
| **前端游戏卡片** | 懒加载 + IntersectionObserver | ✅ | `GameCardComponent` |
| **前端导航栏** | 固定透明/滚动变白 | ✅ | `header.component.scss` |
| **前端创作者页** | 上传/编辑/管理 | ✅ | `GameCreatorComponent`, `GameUploadComponent` |
| **前端游戏运行** | iframe 沙箱 + 通信桥 | ✅ | `GamePlayComponent` |
| **前端通知** | 通知列表/已读 | ✅ | `GameNotificationsComponent` |
| **前端性能** | 性能指标记录 | ✅ | `GamePerformanceService` |

### 1.2 数据模型

| 模型 | 表名 | 核心字段 |
|------|------|----------|
| `GameModel` | game | uuid, title, category, tags, status, playCount, runtimeSha256 |
| `GameFavoriteModel` | gameFavorite | gameId + accountId (复合 PK) |
| `GameRecentModel` | gameRecent | gameId + accountId, lastPlayedAt |
| `GameCoinLedgerModel` | gameCoinLedger | accountId, gameId, amount, kind, day |
| `GameCommentModel` | gameComment | gameId, accountId, inReplyToCommentId, text, deletedAt |
| `GameCommentReactionModel` | gameCommentReaction | commentId + accountId (唯一) |
| `GameRatingModel` | gameRating | gameId + accountId, type (like/dislike) |
| `GameReviewModel` | gameReview | gameId + accountId (唯一), score, text |
| `GameNotificationModel` | gameNotification | recipientAccountId, actorAccountId, kind, message, readAt |
| `GameReportModel` | gameReport | reporterAccountId, gameId, reason, state |
| `GameStatsSummaryModel` | gameStatsSummary | gameId (唯一), plays, likes, dislikes, favorites, coins, comments, reviews, averageReviewScore |

### 1.3 API 端点

共 **30+ 端点**，覆盖：
- 游戏列表/详情/CRUD (`/api/v1/games/`)
- 运行时/封面 (`/api/v1/games/:uuid/runtime/`, `cover`)
- 社区互动 (`community`, `comments`, `reviews`, `rate`, `favorite`, `follow`, `coin`)
- 用户个人 (`me/favorites`, `me/recent`, `me/recommendations`, `me/owned`, `me/overview`, `me/notifications`)
- 审核 (`admin`, `moderate`)

---

## 二、B 站游戏社区功能矩阵

### 2.1 B 站核心功能

| 领域 | B 站功能 | GameHub 对应 | 差距 |
|------|----------|-------------|------|
| **首页布局** | Banner 轮播 + 精选 + 排行 + 分类 | GamesHomeComponent + 精选位 + 排行榜 | ✅ 基本对齐 |
| **游戏详情** | 封面/截图/视频/PV/描述/评分/预约/攻略/WIKI | 封面 + 截图集 + 评分 + 预约 | ⚠️ 截图+预约已做，无攻略区 |
| **排行榜** | 热度/预约/新游/口碑/B指/端游/开测 | `/rankings` API (hot/newest/topRated) | ✅ 基本对齐 |
| **互动** | 点赞/投币/收藏/一键三连/分享/弹幕/充电 | 点赞+投币+收藏+关注+分享+一键三连 | ⚠️ 核心互动已对齐，无弹幕/打赏 |
| **评论** | 多级评论 + 图片评论 + 精选评论排行 | ✅ 排序(hot/new/old) + 精选(>=10赞) | ✅ 已对齐 |
| **创作者** | 数据中心/粉丝分析/收益管理/创作激励 | ✅ 播放趋势/互动分布/游戏排行/粉丝增长 | ⚠️ 数据分析已做，无收益系统 |
| **社区** | 动态/话题/活动/论坛/攻略/BWIKI | ✅ 预约/等级/标签聚合/精选/SEO | ⚠️ 基础功能有，论坛/攻略缺失 |
| **推荐** | 三阶段管线(召回-排序-重排) + 双塔模型 | ✅ 协同过滤 + Redis缓存 + 偏好模型 | ⚠️ 基础推荐已对齐，需进一步调优 |
| **运行方式** | APK/云游戏/H5 小游戏/Toy 互动作品 | HTML 单文件 iframe | ⚠️ 仅支持 HTML；不支持多文件包、云游戏 |
| **会员/等级** | LV0-6 + 硬核会员 + 大会员 + 硬币 | ✅ 硬币 + 等级(LV0-6) + 经验值 | ⚠️ 等级+硬币已做，无大会员 |
| **搜索** | 全站搜索 + 标签搜索 + 热门推荐 + 偏好调节 | ✅ pg_trgm相似度 + 标签聚合/分类聚合 | ⚠️ 搜索已对齐，偏好模型未接入推荐 |
| **小游戏平台** | 开发者文档/SDK/支付/广告/引擎适配 | 无平台化 | ❌ 无开发者平台 |
| **举报/审核** | 举报 + 审核 + 黑名单 | 举报 + 审核 + 状态流转 + 精选管理 | ✅ 基本对齐 |
| **通知** | 站内 + 邮件 + 推送 | ✅ 站内通知(批量+去重+重试) + 邮件通知 | ⚠️ 站内已对齐，邮件依赖SMTP配置 |

---

## 三、功能差距与优先级分析

### 🔴 P0 — 核心缺失（影响基本可用性）

| # | 功能 | 说明 | 参考来源 |
|---|------|------|----------|
| 1 | **排行榜页面** | 独立排行页：热门榜、新品榜、评分榜 | B 站排行系统 |
| 2 | **游戏截图集** | 详情页展示多张截图 | B 站游戏详情 |
| 3 | **分享功能** | 生成分享链接/二维码 | B 站互动 |
| 4 | **社区动态** | 关注的游戏/作者动态 Feed | B 站动态 |

### 🟡 P1 — 重要增强（提升体验和留存）

| # | 功能 | 说明 | 参考来源 |
|---|------|------|----------|
| 5 | **精选/编辑推荐** | 首页编辑推荐位 + Banner 轮播 | B 站首页精选 |
| 6 | **专题合集** | 按主题聚合游戏 | B 站发现页 |
| 7 | **一键三连** | 点赞+投币+收藏合并操作 | B 站标志性互动 |
| 8 | **评论排序/精选** | 热度排序 + 精选评论 | B 站评论区 |
| 9 | **创作者数据分析** | 播放趋势/粉丝增长/互动分布 | B 站创作者中心 |
| 10 | **用户等级体系** | 行为积分 + 等级 + 特权 | B 站 LV0-6 |
| 11 | **游戏预约** | 未发布游戏预约 + 通知 | B 站预约功能 |
| 12 | **邮件/推送通知** | 除站内外增加邮件和推送 | B 站通知 |
| 13 | **个性化推荐偏好** | 用户可调节推荐偏好 | B 站偏好调节 |

### 🟢 P2 — 生态建设（长期竞争力）

| # | 功能 | 说明 | 参考来源 |
|---|------|------|----------|
| 14 | **开发者平台** | SDK/文档/支付/广告 | B 站小游戏平台 |
| 15 | **多文件游戏包** | 支持 zip 上传多资源 | B 站 H5 小游戏 |
| 16 | **攻略/WIKI 区** | 玩家贡献攻略 + 百科 | B 站 BWIKI |
| 17 | **广告变现(IAA)** | 游戏内广告分成 | B 站 IAA 模式 |
| 18 | **内购(IAP)** | 游戏内支付 | B 站 IAP 模式 |
| 19 | **云游戏** | 无需下载即玩 | B 站云游戏 Beta |
| 20 | **活动系统** | 运营活动/赛事/嘉年华 | B 站活动 |
| 21 | **弹幕** | 实时评论飘屏 | B 站核心特色 |
| 22 | **打赏/充电** | 对创作者打赏 | B 站充电计划 |

---

## 四、GameHub 独特优势（B 站不具备）

| 能力 | 说明 |
|------|------|
| **ActivityPub 联邦** | 游戏可以跨实例联邦传播，B 站是中心化平台 |
| **开源/自托管** | 任何人可部署自己的游戏社区实例 |
| **HTML 沙箱安全** | 严格的 CSP + SHA256 校验 + 禁止外连，B 站小游戏的沙箱安全不如 |
| **轻量级** | 不依赖 APP/SDK，纯 Web 体验 |
| **去中心化审核** | 每个实例独立审核策略 |

---

## 五、下一步执行建议

### 第一阶段：补齐核心体验（2-3 周）

1. **排行榜页面** — 新增 `/games/rankings` 路由和组件，支持热门/新品/评分三个维度
2. **游戏截图集** — GameModel 增加 `screenshots` 字段（ARRAY TEXT），上传支持多图
3. **分享功能** — 前端生成分享链接 + 复制到剪贴板，后端增加短链 API
4. **首页精选位** — GameModel 增加 `featured` 字段，首页优先展示

### 第二阶段：社区与互动增强（3-4 周）

5. **一键三连** — 合并 API `POST /:uuid/triple`，前端动画反馈
6. **评论排序** — 按 hot/new/old 排序，精选评论标记
7. **动态 Feed** — 关注的游戏/作者发布动态，基于现有通知系统扩展
8. **创作者数据** — 播放趋势图、粉丝增长、互动漏斗

### 第三阶段：生态建设（5-8 周）

9. **用户等级** — 经验值 + 等级 + 头衔
10. **游戏预约** — 预约模型 + 到期通知
11. **多文件包** — zip 上传 + 解压校验
12. **开发者平台** — 文档站 + SDK 示例

---

## 六、技术债务

| 问题 | 严重度 | 说明 |
|------|--------|------|
| GameStatsSummaryModel 表可能未创建迁移 | 高 | 新增模型需要迁移文件 |
| `gameStatsSummary` 表缺少迁移 | 高 | 需创建 migration 1101 |
| 协同过滤推荐对大数据量性能不佳 | 中 | 每次查询需遍历多用户交互，应缓存结果 |
| runtime 资源未缓存到 Redis | 低 | 目前靠 ETag + 浏览器缓存 |
| 游戏列表查询仍使用子查询聚合 | 中 | 应使用 GameStatsSummaryModel 替代 getPublicStatsAttributes 的子查询 |
| 前端缺少错误边界展示 | 低 | GameErrorBoundaryComponent 存在但内容为空 |
| 邮件通知未配置 | 中 | SMTP 未设置，影响用户激活流程 |
