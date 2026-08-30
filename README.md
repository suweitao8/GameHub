<h1 align="center">GameHub</h1>

<p align=center>
  <strong>HTML5 在线游戏平台</strong> — 游戏中心、投稿分发、社区互动与玩家账户体系。
</p>

## 简介

GameHub 是一个面向玩家的 HTML5 网页游戏平台：

- **游戏中心**：分类浏览、搜索、推荐流（多因子个性化排序）、轮播精选
- **即开即玩**：游戏以静态 HTML 包上传，沙箱化运行时直接在浏览器运行
- **投稿与创作**：创作者上传游戏（封面自动生成）、编辑管理、数据分析看板
- **社区**：评论、讨论区、活动/预约、文章资讯、收藏与稍后玩
- **玩家系统**：账号注册登录、经验等级、个人通知、游戏时长统计

## 最新更新

### 2026-08-30

- 修复游戏中心搜索框叠加边框，统一主要账户/游戏页面标题层级，并增强品牌按钮文字对比度，详见[完整更新记录](docs/releases/release-notes.md)。

优化游戏态账户弹窗，新增个人中心与我的主页入口，并展示关注、粉丝和游戏数量等个人数据。

统一 GameHub 全站品牌视觉：以 Bilibili 蓝 `#00aeec` 为主色、Bilibili 粉为行动强调色，统一游戏中心、社区、账户、登录、提示和生成式视觉资源的色彩语义，详见[完整更新记录](docs/releases/release-notes.md)。

优化登录用户头像资料卡的单头像展开转场，恢复资料卡在动态入口旁的正确中心锚点，并修复重复头像、原位残留圆框和退出时弹窗残留问题，详见[完整更新记录](docs/releases/release-notes.md)。

重设计 GameHub 品牌 Logo：页头和移动菜单使用 Bilibili 蓝的 GameHub 横向字标，浏览器标签页与方形 Logo 使用统一的 G 图标，移除彩虹渐变，详见[完整更新记录](docs/releases/release-notes.md)。

全面中文化游戏中心、社区、账户流程、登录注册、错误提示和通用控件，认证过期等英文提示统一改为中文，并确保轻量构建直接输出中文界面，详见[完整更新记录](docs/releases/release-notes.md)。

### 2026-08-29

- 统一游戏中心、社区、详情、投稿、账户和登录页面的视觉样式与交互状态，详见[完整更新记录](docs/releases/release-notes.md)。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Angular SPA（`client/`） |
| 后端 | Node.js / Express + Sequelize（PostgreSQL）（`server/`） |
| 任务队列 | BullMQ / Redis |
| 游戏存储 | 本地磁盘或 S3 兼容对象存储 |

> 项目底座源自 [PeerTube](https://github.com/Chocobozzz/PeerTube)（AGPL-3.0）的账户、权限、任务队列等基础能力，
> 视频播放/转码/联邦相关领域代码已由游戏域模型（`server/core/models/game/`、`client/src/app/+games/`）取代。
> 上游贡献者信息见 [CREDITS.md](CREDITS.md)。

## 开发环境

前置依赖：Node.js >= 22.x、pnpm >= 10.9、PostgreSQL（启用 `pg_trgm`、`unaccent` 扩展）、Redis >= 6.x。

```bash
# 启动开发依赖（PostgreSQL / Redis）
docker compose -f support/docker/development/docker-compose.yml up -d

# 安装依赖
pnpm install --frozen-lockfile

# 构建
pnpm run build:server
pnpm run build:client   # Windows 可用: pnpm run build:client:light

# 启动（http://127.0.0.1:9000）
$env:NODE_ENV = 'dev'
$env:NODE_CONFIG = '{"redis":{"port":6381}}'
pnpm run start
```

开发凭据：`root / test`

### 质量门禁

```bash
pnpm run self-test:gamehub   # 交付前必须通过（构建 + lint + SPA 冒烟验证）
pnpm run lint                # oxlint + OpenAPI 校验
```

详细工作流约定见 [AGENTS.md](AGENTS.md)。

## 许可证

[AGPL-3.0](LICENSE)。基于网络交互的修改须以相同许可证开放源代码。
