# GameHub HTML 小游戏社区改造分析

## 1. 当前架构与可复用能力

GameHub 当前是 PeerTube 8.2.2 单体应用：Node.js/Express 服务端、Angular SPA、Sequelize/PostgreSQL、BullMQ/Redis、FFmpeg，以及 ActivityPub 联邦层。

请求链路为：

```text
Angular route/component
  -> REST /api/v1
  -> Express controller + validator + authenticate/role guard
  -> service/model/job queue
  -> PostgreSQL / Redis / filesystem
```

可以直接复用的能力：

| 能力 | 当前入口 | 结论 |
| --- | --- | --- |
| 注册、登录、OAuth token | `server/core/controllers/api/users/` | 直接复用 |
| 角色与权限 | `UserModel.role`、`authenticate`、moderator/admin guards | 直接复用 |
| 注册审核 | `api/users/registrations.ts` | 直接复用，Game 发布审核可复用相同状态模型 |
| 作者身份与主页 | `AccountModel`、`VideoChannelModel`、`/a`、`/c` | 直接复用 |
| 评论 | `api/videos/comment.ts`、`VideoCommentModel` | 通过 Game 的内容壳复用 |
| 点赞/互动 | `api/videos/rate.ts` | 通过 Game 的内容壳复用 |
| 收藏 | 用户视频播放列表 API | 将 Game 内容壳加入用户播放列表 |
| 关注作者 | `api/users/my-subscriptions.ts`、`api/server/follows.ts` | 直接复用 |
| 通知 | `api/users/my-notifications.ts`、JobQueue email/notification jobs | 直接复用 |
| 举报、封禁、黑名单 | `api/abuse.ts`、`api/blocklist.ts`、moderation services | 复用权限和审核流程，新增 Game target 类型 |
| 搜索 | `api/search/`、数据库查询/索引 | 首期增加 Game 查询适配器，后续可接入统一索引 |
| 上传、配额、审核操作日志 | 用户/频道权限、文件存储、audit logger | 复用校验和审计模式，新增 HTML 文件规则 |

当前开发环境已验证 PostgreSQL、Redis、PeerTube API 和 Angular 多语言页面可运行；SMTP 仍未配置，因此邮件相关流程只能复用数据库状态和站内通知。

## 2. 插件、主题和核心修改边界

### 可以通过插件或主题实现

- 首页、导航、推荐卡片和游戏发现页面。
- `/p/...` 插件页面、插件客户端脚本和自定义 CSS。
- 游戏运行页、全屏按钮、重新加载、操作说明和相似游戏展示。
- Game API 的非核心展示接口、上传表单和管理页面。
- 首页隐藏视频导航、直播、导入等入口。
- 基于现有视频事件 hooks 的推荐、审计和通知扩展。

PeerTube 插件可以通过 `getRouter()` 注册服务端 Express 路由，路由自动附带当前用户认证上下文；可以使用 `storageManager` 保存 JSON 和插件数据目录文件；客户端可通过 `clientScripts` 和 `action`/`filter` hooks 扩展界面。

### 必须进入核心或共享扩展层

- `Game` 持久化模型、迁移和权限边界。
- Game 与 PeerTube 内容壳、频道、评论、互动、播放列表的关联。
- Game 的公开/待审核/拒绝/下架状态及管理员 API。
- 游戏文件上传的类型、大小、路径和内容校验。
- 搜索、推荐和首页查询的数据适配。
- 对默认视频 API 的 Game 内容保护，防止出现空白视频或绕过审核的入口。

不建议把大量 Game 数据放入插件 `storageManager` 的单个 JSON 键，也不建议为评论、点赞、关注、通知重新实现一套账号系统。

## 3. 推荐的 Game 集成方式

第一阶段采用“新增 Game 实体 + PeerTube 内容壳”的适配方案：

```text
Game
 ├─ id/status/title/description/category/tags
 ├─ ownerAccountId/channelId
 ├─ runtimePath/coverPath/fileSize
 └─ videoId -> PeerTube Video 内容壳
       ├─ comments
       ├─ rate/like
       ├─ user playlist/favorite
       ├─ channel/author/follow
       └─ existing moderation/notification relations
```

这样不会把现有 `Video` 全局重命名为 `Game`，也不会删除视频底层代码；Game API 负责只展示有 Game 记录且状态允许公开的内容。默认视频列表应过滤或隐藏 Game 内容壳，避免用户看到没有视频媒体的页面。

首版只接受单个 HTML 文件。Game 记录和内容壳创建必须在同一事务内完成，上传文件使用随机 ID 目录，不能使用用户提供的文件名作为路径。

## 4. HTML 游戏安全隔离

安全边界优先级如下：

1. 游戏文件不放在 `client/dist`、用户上传媒体公开目录或服务端源码目录。
2. 游戏运行使用独立的游戏静态路由；生产环境使用 `games.<domain>` 独立域名，开发环境至少使用独立 host 或沙箱 iframe。
3. 主站嵌入使用不含 `allow-same-origin` 的 `sandbox` iframe，仅开放脚本和全屏所需能力；不开放顶层导航、表单、弹窗和任意权限。
4. 游戏响应设置严格 CSP：禁止访问主站、禁止 `connect-src` 外连、禁止对象和外部 frame；首版拒绝外部脚本、图片、音频和 CSS 依赖。
5. 上传限制 HTML MIME/扩展名、大小、频率、账号配额；拒绝路径穿越、符号链接和危险归档格式。
6. 游戏状态必须经过审核才能进入公开推荐；管理员可下架、封禁或删除运行文件。

仅依赖“不同端口”不构成安全隔离，因为 Cookie 不按端口隔离；生产环境必须使用独立 host/域名或沙箱造成的 opaque origin。

## 5. 视频功能处理原则

第一阶段保留 PeerTube 视频表、上传、转码、ActivityPub 和后台代码，采用配置与界面控制：

- 普通用户导航默认进入 Game 首页，隐藏普通视频发布入口。
- 直播、视频导入和不需要的转码任务在开发/游戏实例配置中停用。
- 保留管理后台和兼容路由，避免删除代码阻断升级和安全补丁。
- 对 Game 内容壳增加显式标记，在视频详情、搜索、推荐和 ActivityPub 路径做边界过滤。

## 6. 第一阶段 MVP 步骤

1. 新增 Game 模型、迁移、状态枚举、权限校验和 API contract。
2. 实现单文件 HTML 上传、封面、元数据、作者频道关联、大小/频率限制。
3. 实现审核、发布、拒绝、下架、删除和操作审计。
4. 实现隔离运行地址、沙箱 iframe、加载失败提示、重新加载和全屏。
5. 实现 Game 首页卡片、最新/热门/分类/搜索和作者页适配。
6. 接入内容壳的评论、点赞、收藏、关注和通知，并验证权限边界。
7. 隐藏视频入口，保留兼容路由，完成普通用户与管理员端到端验证。

第一阶段不实现 ZIP 多文件游戏、外部资源依赖、复杂推荐、付费、广告、多人联机、云存档和大规模 Video 重构。

## 7. 主要风险

- **安全风险**：HTML/JavaScript 是主动内容，sandbox、CSP、独立 host 和上传校验必须同时存在，不能依赖正则扫描单独防护。
- **数据边界风险**：内容壳若没有统一 Game 标记，可能出现在默认视频列表、联邦或播放器路由中。
- **升级风险**：直接改动评论、搜索和视频控制器会增加 PeerTube 合并成本，应集中在适配器和边界过滤层。
- **任务风险**：Game 不需要 FFmpeg，但不能误进入视频转码队列；上传 API 必须与视频上传队列隔离。
- **邮件风险**：本地 SMTP 未配置时，注册审核和密码找回邮件不会发送；MVP 必须提供站内状态和管理员操作反馈。
- **许可证风险**：网络服务修改继续遵循 AGPL-3.0；插件及其前端/服务端代码的许可证和发布方式需要同步确认。

## 8. 验收标准

验收必须覆盖：玩家发现、搜索、试玩、全屏、评论、点赞、收藏、关注；创作者上传、编辑、审核、发布、下架；管理员审核、下架、封禁；以及恶意 HTML 无法读取主站 Cookie、访问主站 API 或跳转主站顶层页面。
