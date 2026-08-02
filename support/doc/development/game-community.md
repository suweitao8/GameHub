# GameHub 游戏社区开发入口

GameHub 前台统一使用 PeerTube 的同一服务端口提供访问，不需要用户打开单独的 Angular 端口。

## 启动

在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm run tsc -b server/tsconfig.json
pnpm run resolve-tspaths:server
pnpm --dir client ng build --localize=false --output-path dist/en-US --configuration production
pnpm run start:server
```

默认访问地址：

- GameHub 首页：`http://127.0.0.1:9000/games`
- 上传游戏：`http://127.0.0.1:9000/games/upload`

`/videos/browse` 会重定向到 `/games`。`4300` 和内部 API 端口只用于特殊的前端热更新调试，不是用户入口。

## 游戏包格式

- 只接受单个 `.html` 或 `.htm` 文件，最大 20MB。
- 禁止上传 ZIP、多文件资源包或任何其他格式；游戏内容必须自包含在这个 HTML 文件中。
- 禁止外链、联网、路径穿越、顶层跳转和危险文件。

上传页会先进行隔离预览和安全检查，再生成封面并提交审核。
