# HTML 小游戏社区前台改造清单

日期：2026-07-18

## 当前审计结论

现有代码已经具备 `GameModel`、单文件 HTML 安全运行、审核 API、游戏首页和试玩页，但用户侧仍然由 PeerTube 的 Header、左侧视频菜单、视频卡片、账号空间和频道页组成。当前 `/games` 只是一个游戏功能入口，不是完整的游戏内容社区。

## 信息架构

| 页面 | 路由 | 目标 | 主要复用 |
| --- | --- | --- | --- |
| 首页 | `/games`、`/home` | 推荐、热门、最新、分类和关注作者内容 | `GamesService`、`AuthService` |
| 搜索 | `/games/search` | 游戏名、作者、分类、标签和排序筛选 | PeerTube Router、游戏列表 API |
| 试玩详情 | `/games/:uuid` | 安全运行区、互动、评论、作者和相关推荐 | Video 内容壳、评论/评分/关注/举报服务 |
| 作者空间 | `/games/author/:handle` | 作者资料、关注、游戏、收藏、动态 | Account/Actor API、头像和关注服务 |
| 我的游戏 | `/games/library` | 收藏和历史 | GameFavorite、GameRecent |
| 创作中心 | `/games/creator` | 概览、上传、管理、数据、审核状态 | Game API、PeerTube 账号权限 |
| 上传 | `/games/upload` | 分步骤投稿、检测、封面、审核 | 上传进度组件、Game API |
| 审核 | `/games/manage`、`/admin/games` | 管理员审核和下架 | PeerTube moderator 权限和审计日志 |

## 全局组件

- `GameNavigationComponent`：固定顶部 Logo、首页、热门、分类、最新、关注、搜索、消息、收藏、历史、创作中心和上传入口；复用 Header 的登录态、头像、通知和退出菜单。
- `GameCardComponent`：统一 16:9 封面、标题、作者、游玩次数、点赞、投币、收藏、分类、设备标签和悬停试玩提示。
- `GameSectionComponent`：标题、排序/换一换操作、横向或网格内容容器、加载骨架和空状态。
- `GameAuthorComponent`：头像、昵称、作者标识、关注按钮、粉丝和累计游玩摘要。
- `GameInteractionBarComponent`：点赞、投币、收藏、分享、举报；按钮有禁用、成功、失败和即时反馈状态。
- `GameCommentListComponent`：一级评论、二级回复、作者标识、点赞、举报和删除入口，不刷新详情页。
- `GameStateComponent`：统一 loading、空数据、401、403、404 和提交失败状态。

## 页面改造边界

1. `AppComponent` 根据游戏前台路由增加 `game-experience` 状态，隐藏左侧 PeerTube 视频菜单并使用无侧栏内容宽度。
2. `HeaderComponent` 在游戏前台显示 `GameNavigationComponent`，保留登录、通知、头像和账号设置；普通视频 Header 仍保持兼容。
3. `GamesHomeComponent` 改为多个内容分区，而非单一列表；服务端支持推荐、热门、最新、分类、标签和关注作者筛选。
4. `GamePlayComponent` 增加运行状态、键盘焦点、静音提示、分享、投币、更新日志、本地存档提示、作者其他游戏和相关游戏。
5. 新增作者空间，使用 Game API 查询作者公开资料和游戏，不把 HTML 游戏伪装成普通视频列表。
6. 上传页面改为步骤状态流：上传、文件检查、启动检测、截图/封面、元数据、提交审核；保留单文件安全限制。
7. 新增创作中心概览、游戏管理和统计入口，显示 5 个游戏、100MB 总配额、20MB 单文件上限以及游玩/点赞/投币/收藏/粉丝摘要。
8. 搜索、收藏、历史和作者游戏全部使用 `GameCardComponent`，避免后台表格式呈现。

## 设计系统

- 背景：浅灰页面底色，白色内容卡片。
- 品牌色：使用 GameHub 橙色作为主要行动色，禁止大面积渐变。
- 栅格：内容最大宽度 1280px，桌面 5/4/3 列自适应，移动端 2/1 列。
- 封面：固定 `aspect-ratio: 16 / 9`，`object-fit: cover`。
- 间距：4、8、12、16、24、32、48px 节奏。
- 圆角：卡片 10px、按钮 8px、头像 50%。
- 阴影：默认细边框，悬停使用轻量阴影和 2px 上移。
- 状态：统一 loading skeleton、成功橙色/绿色反馈、警告和错误提示；所有按钮保留键盘 focus-visible。
- 响应式：1366×768 和 1920×1080 优先，导航在 900px 以下折叠，试玩区保持比例。

## 数据和复用方案

- 账号、角色、登录、注册审批、封禁、通知和账号设置继续使用 PeerTube 现有服务。
- 作者身份通过 Game owner account 和关联默认 channel 暴露，关注动作继续调用 ActorFollow。
- 评论、评论回复、评论举报和管理员删除继续使用 Video 内容壳适配层；Game 页面只暴露 Game UUID。
- 点赞继续复用 Video rate；投币新增 GameCoinLedger，记录每日余额、单游戏上限和不可撤回流水；收藏和历史使用 GameFavorite/GameRecent。
- Game API 返回前台卡片所需的作者、互动和统计字段，禁止每个卡片自行重复请求。
- 普通视频、直播、导入和原有管理页面保留兼容路由，但不出现在游戏前台导航中。

## 验收重点

- 游戏前台不再显示 PeerTube 左侧视频菜单和视频站默认首页卡片。
- 主要页面都有固定游戏导航，并且登录/未登录状态、头像菜单和返回路径正确。
- 首页、搜索、作者、收藏、历史、详情和创作中心都使用统一卡片和设计 token。
- 试玩区保留 `sandbox="allow-scripts"`，没有 `allow-same-origin`，并通过浏览器验证 Cookie、顶层导航和外部请求隔离。
- 1366、1920 和移动宽度下没有横向溢出，关键按钮可见且可键盘操作。
