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

- 单文件：`.html` 或 `.htm`，最大 20MB。
- 资源包：`.zip`，根目录必须包含 `index.html`，压缩包和解压后资源总量均受 20MB 限制。
- ZIP 可以包含相对路径的图片、音频、CSS 和 JavaScript。
- 禁止外链、联网、路径穿越、顶层跳转和危险文件。

上传页会先进行隔离预览和安全检查，再生成封面并提交审核。
