# HTML 小游戏社区改造设计规格

日期：2026-07-18

状态：已选定方案，进入实现

## 目标

在 PeerTube 8.2.2 上增加以单文件 HTML 小游戏为核心的内容社区，保留现有账号、角色、注册审核、评论、互动、关注、通知、举报和管理后台能力，不重命名或删除 Video 核心模型。

第一阶段完成一条可验收的闭环：创作者上传单文件 HTML 游戏，管理员审核发布，玩家从首页发现并在隔离容器内试玩，同时可以进入作者页并使用评论、点赞、收藏和关注能力。

## 方案选择

### 采用：Game 实体 + PeerTube 社区内容壳

新增 Game 表和 Game API，Game 保存游戏业务字段；每个已发布游戏可关联一个 PeerTube Video 内容壳，以复用 PeerTube 已有的作者、评论、评分、播放统计、收藏播放列表、关注和举报关联。

Game 和 Video 的边界由明确的关联字段以及 API 层过滤保证。普通视频页面不显示 Game 内容壳，Game 页面不依赖视频转码和视频播放器。

### 不采用的方案

1. 仅使用插件存储 JSON：虽然减少核心表改动，但会重复实现查询、权限、互动和审核，无法稳定支撑社区功能。
2. 直接把 Video 全局改名为 Game：会破坏 ActivityPub、视频 API、转码和升级路径，也无法自然表达 HTML 文件安全运行状态。

## 数据模型

新增 `GameModel`，首版字段如下：

- `id`：自增主键。
- `uuid`：公开稳定标识，唯一。
- `videoId`：可空的 PeerTube Video 内容壳关联，唯一；首版通过适配层复用互动能力。
- `ownerAccountId`、`channelId`：创作者和频道关联。
- `title`、`description`、`instructions`：展示信息。
- `category`、`tags`：推荐和搜索字段。
- `coverPath`：封面文件相对路径。
- `runtimePath`：HTML 运行文件相对路径；只允许服务层生成，不能来自用户路径。
- `runtimeSha256`、`fileSizeBytes`：完整性与配额统计。
- `status`：`pending`、`published`、`rejected`、`unlisted`、`blocked`。
- `moderationReason`、`moderatedByUserId`、`moderatedAt`：审核记录。
- `playCount`、`publishedAt`、`createdAt`、`updatedAt`：基础统计和时间字段。

单文件 HTML 是唯一首版格式。服务端必须拒绝 ZIP、多文件上传、非 HTML MIME、超限文件、路径穿越、符号链接和可疑外部资源引用。

## API 边界

新增 `/api/v1/games`：

- `GET /`：公开的已发布游戏列表，支持 `latest`、`popular`、`category`、`tag` 和搜索词。
- `GET /:uuid`：游戏详情和试玩地址。
- `POST /`：登录创作者上传并创建 `pending` 游戏；管理员可按权限直接发布。
- `PUT /:uuid`：作者或管理员更新元数据、封面和 HTML 文件，重新进入审核状态。
- `DELETE /:uuid`：作者下架/删除自己的游戏，管理员可处理任意游戏。
- `POST /:uuid/moderate`：管理员批准、拒绝、下架或封禁游戏。
- `POST /:uuid/play`：记录一次受限的游玩事件并返回运行地址。

所有非公开接口必须使用 PeerTube 当前认证中间件和角色检查。列表和详情只返回 `published` 游戏；作者可以看到自己的 `pending`、`rejected` 和 `unlisted` 内容，管理员可以看到全部状态。

## HTML 安全隔离

运行文件不放在 `client/dist`、主站静态资源目录或主站页面同源路径中。生产环境使用独立的运行域名，例如 `games.example.com`；开发环境使用 `games.localhost` 或等效独立 origin。仅更换端口不视为隔离，因为不能依赖端口阻止 Cookie 或页面访问。

主站试玩页使用：

```html
<iframe
  sandbox="allow-scripts"
  allow="fullscreen"
  referrerpolicy="no-referrer"
  src="https://games.example.com/runtime/<opaque-id>/index.html">
</iframe>
```

运行响应必须附带严格 CSP：默认禁止资源，脚本仅允许单文件内联脚本，禁止 `connect-src`、表单提交、对象、顶层导航和外部 frame；只按首版需要开放 `data:`/`blob:` 图片、媒体和样式。不得加入 `allow-same-origin`、`allow-top-navigation`、`allow-forms` 或 `allow-popups`。运行域名不设置主站认证 Cookie。

上传流程在写盘前完成扩展名、MIME、大小、哈希、HTML 解析和外部资源策略检查；使用随机 opaque 目录和服务端生成的文件名，拒绝 `..`、绝对路径、符号链接和覆盖已有文件。所有上传、更新、删除、审核、下架和游玩事件写入结构化审计日志。配置提供单文件大小、账号总配额、上传间隔和新账号审核开关。

首版不允许外部 JavaScript、CSS、图片、音频或网络 API。后续 ZIP 支持必须采用同一独立 origin、解压目录白名单和资源审计，不能绕过本版隔离规则。

## 前端体验

新增游戏路由和 Angular 服务，不删除现有视频路由：

- `/games`：推荐、热门、最新、分类和搜索游戏卡片。
- `/games/:uuid`：试玩页，包含运行区、全屏、重新加载、元数据、作者、互动、评论和相似游戏。
- `/my-library/games`：创作者自己的游戏及审核状态。
- `/admin/games`：管理员审核、下架和封禁。

首页默认展示游戏内容。普通用户隐藏视频上传、直播和导入入口；底层视频代码和必要 API 保留，以便安全更新和未来兼容。游戏互动通过已有 PeerTube 路由或明确的适配服务接入，不复制一套账号/评论/关注表。

## 分阶段实现

1. 模型、迁移、状态机、权限和安全校验单元测试。
2. 单文件上传、随机存储、运行响应、CSP 和 sandbox 集成测试。
3. Game API、审核 API、首页/详情页和创作者/管理员页面。
4. 接入评论、点赞、收藏、关注、举报、作者页和基础统计。
5. 隐藏普通视频入口，关闭不需要的直播/导入路径，并完成玩家、创作者、管理员端到端验证。

## 验收标准

- `suweitao` 管理员可以审核、下架和封禁游戏；普通用户不能调用管理员接口。
- 登录创作者只能看到和修改自己的游戏，并受大小、频率和配额限制。
- 发布后的游戏会出现在首页/搜索，点击后可在隔离 iframe 中运行。
- 运行页面不能读取主站 Cookie，不能访问主站 DOM，不能顶层跳转，不能通过网络 API 外传数据。
- 玩家可以查看作者、评论、点赞、收藏、关注、举报并看到相关推荐。
- 旧 Video 模型、账号登录和 PeerTube 现有服务仍可构建并启动。
- 关键行为有测试、审计日志和可复现的运行验证。

## 风险和取舍

- PeerTube Video 互动能力与 Game 关联需要适配层，不能假设所有视频 API 自动理解 Game。
- 独立运行域名必须在生产反向代理和开发环境都明确配置；CSP 和 iframe 属性缺一不可。
- 新表迁移必须追加，不能修改历史迁移；上传文件存储需要和 PeerTube 媒体清理机制分开。
- PeerTube 是 AGPL-3.0，网络提供的修改需要按许可证要求发布对应源代码。
