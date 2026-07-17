---
name: project-workflow
description: GameHub 通用开发工作流。用于功能、修复、重构、规则维护、启动验证和 worktree 收尾，要求隔离开发、真实验证和安全清理。
---

# GameHub 通用开发工作流

## 适用范围

用于 PeerTube/GameHub 的日常二次开发。根目录 `AGENTS.md` 是项目规则真相源，进入 `client/` 时同时遵循 `client/AGENTS.md`。

## 执行顺序

1. 先检查 `git status --short --branch`、当前分支和 `git worktree list --porcelain`。
2. 功能、修复、重构在 `D:\Github\_worktrees\GameHub\<task-name>` 的独立 worktree 中完成；规则/文档可在主工作区修改。
3. 先定位真实入口和调用链，再做最小修改；设计方向已明确时直接执行，不重复请求设计确认。
4. 按改动范围执行构建、lint、API schema 和运行时验证。
5. 只提交预期文件；用 `git diff --check` 和 `git status --short` 做收尾检查。
6. 提交后合并、推送、删除当前 worktree，再执行 `git worktree prune`，不得删除其他任务的 worktree。

## PeerTube 启动验证

开发依赖使用 `support/docker/development/docker-compose.yml` 启动 PostgreSQL 和 Redis。源码启动前需要生成 server/client 构建产物：

```powershell
docker compose -f support/docker/development/docker-compose.yml up -d
pnpm install --frozen-lockfile
pnpm run build:server
pnpm run build:client
$env:NODE_ENV = 'dev'
$env:NODE_CONFIG = '{"redis":{"port":6381}}'
pnpm run start
```

必须用 `Invoke-WebRequest http://127.0.0.1:9000/api/v1/ping` 或等价 HTTP 请求验证服务，不以“进程已启动”代替可用性判断。

## 安全边界

- 不提交 `node_modules`、`dist`、本地配置、运行日志、截图、媒体文件或数据库数据。
- 不修改已发布 migration；schema 改动只能追加 migration。
- 不手工编辑 `pnpm-lock.yaml`。
- 不把占用中的、脏的或所有权不明的 worktree 当作清理对象。
