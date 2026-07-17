# HTML 游戏社区本地开发

## 运行结构

- PeerTube API、认证、数据库迁移：`http://127.0.0.1:9010`
- Angular 游戏社区开发前端：`http://127.0.0.1:4300/games`
- 游戏运行时：`http://games.localhost:9010`
- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6381`

`4300` 的代理只转发 `/api` 和 `/client`，`/games` 必须由 Angular 路由接管；否则会回到 PeerTube 服务端页面。

## 启动

```powershell
docker compose -f support/docker/development/docker-compose.yml up -d
pnpm install --frozen-lockfile
pnpm run tsc -b server/tsconfig.json
pnpm run resolve-tspaths:server

$env:NODE_ENV = 'dev'
$env:NODE_CONFIG = '{"listen":{"port":9010},"webserver":{"port":9010},"redis":{"port":6381},"games":{"runtime_origin":"http://games.localhost:9010"}}'
node dist/server
```

另开终端启动客户端：

```powershell
Set-Location client
ng serve --host 127.0.0.1 --port 4300 --proxy-config ./proxy.game-community.config.json
```

生产部署仍需由 Nginx 或其他反向代理将 Angular 构建产物作为静态文件提供，并把 `/api`、`/client` 和 `games.localhost` 转发到 PeerTube 服务端；游戏 iframe 必须保留 `sandbox="allow-scripts"` 和禁止网络访问的 CSP。
