# GameHub HTML 游戏资源包上传设计

> **状态：已废弃（2026-08-02）。** 当前实现只接受单个 `.html` 或 `.htm` 文件（最大 20MB），禁止 ZIP 和多文件资源包；本文中的 ZIP 设计不再作为执行依据。

## 目标

让用户从唯一的 GameHub 入口上传并试玩完整 HTML 游戏。系统同时接受单文件 `.html/.htm` 和包含根目录 `index.html` 的 `.zip` 资源包；上传包可以使用安全的相对路径资源，但不能访问外网、跳出运行目录或执行危险文件。

## 当前问题

- `9000/videos/browse` 仍然进入 PeerTube 原视频页面，用户容易误认为新上传功能不存在。
- 当前后端只接收 `gamefile` 的 HTML MIME 类型，并把内容保存成单个 `index.html`。
- 当前 HTML 安全校验把所有非 `data:`、`blob:` 和 `#` 资源都当成外部资源，带 `assets/` 的普通小游戏无法上传。
- 当前运行端点只能返回 HTML，不能为 HTML 解析出的相对路径提供同一游戏目录下的静态资源。
- 校验异常没有统一转换成适合用户理解的中文错误。

## 方案选择

采用 HTML 与 ZIP 双模式，而不是只放宽单文件校验或只支持 ZIP：

1. 单文件 HTML 继续保留，兼容已经准备好的自包含小游戏。
2. ZIP 作为完整游戏包格式，入口固定为包根目录的 `index.html`。
3. 不允许任意服务器部署、Node 服务、数据库或外部网络；小游戏仍在隔离 iframe 中运行。

## 资源包契约

### 单文件 HTML

- 扩展名必须是 `.html` 或 `.htm`。
- `text/html`、`application/xhtml+xml` 和浏览器可能产生的通用二进制 MIME 均按扩展名和内容校验，不因为 MIME 猜测失败拒绝合法 HTML。
- 解码后的文件大小不超过 20 MiB。
- 资源必须是内联 `data:`/`blob:`、片段标识符或 ZIP 模式中允许的相对路径；禁止 `http(s):`、协议相对 URL、绝对路径和外部跳转。

### ZIP 游戏包

- 上传压缩包扩展名必须为 `.zip`。
- 压缩包大小不超过 20 MiB，解压后的总文件大小不超过 20 MiB，最多 200 个文件。
- 必须存在且只允许一个根目录入口 `index.html`（兼容 `index.htm` 时先规范化为入口文件）。
- 允许的文件类型：HTML、CSS、JavaScript、PNG、JPEG、WEBP、GIF、SVG、MP3、WAV、OGG、M4A、JSON、字体数据文件；禁止可执行文件、脚本解释器文件、WASM、符号链接语义和未知扩展名。
- 文件路径必须使用正斜杠、不能是绝对路径、不能包含 `..`，规范化后必须位于游戏临时目录内；拒绝重复路径和大小写冲突入口。
- HTML 中的 `src`、`href`、`data`、CSS `url()` 等资源只能引用包内相对路径、片段、`data:` 或 `blob:`；不允许网络 URL。
- HTML 和包内 JavaScript 禁止 `fetch`、`XMLHttpRequest`、`WebSocket`、`sendBeacon`、顶层导航、`window.open` 等现有禁用 API。

解压先进入随机临时目录，完成全部校验后再原子移动到 `CONFIG.STORAGE.GAMES_DIR/<uuid>/`。失败时删除临时目录，不留下半成品。

## 后端边界

新增/调整 `server/core/lib/games/game-runtime.ts`：

- `validateSingleHtmlGame` 保留单文件规则，但统一返回结构化校验错误。
- 新增资源包验证与存储函数，输出入口相对路径、解压后总大小、文件数量和所有文件的 SHA-256 汇总值。
- 复用 `server/core/helpers/unzip.ts` 的 yauzl 能力，但在游戏专用层额外验证路径、扩展名、重复条目、入口和资源引用。
- 存储结果以游戏目录为单位清理，避免更新或失败时只删除 `index.html` 而残留资源。

调整 `server/core/controllers/api/games/index.ts`：

- `gamefile` 接收 `.html/.htm/.zip`，不只依赖 MIME 映射。
- 创建和更新共用同一套检测/存储函数。
- 将格式、资源、安全和配额错误映射为 400/409，并返回中文 `error` 文本；未预期异常仍交给全局错误处理。
- `fileSizeBytes` 记录解压后资源总量，保持现有配额、维护数量和审核状态逻辑。

调整 `server/core/controllers/api/games/runtime.ts`：

- `GET /api/v1/games/:uuid/runtime` 返回入口 HTML。
- `GET /api/v1/games/:uuid/runtime/*` 在同一安全目录内返回资源文件，并根据白名单设置 Content-Type。
- 两类端点共用 `getGameRuntimeHeaders`，继续使用 `default-src 'none'`、无网络连接、禁止顶层导航和受限 `frame-ancestors`。
- 禁止目录遍历、目录列表、任意文件读取和非白名单扩展名。

## 前端边界

- `game-upload.component` 的选择器接受 `.html,.htm,.zip`，提交前显示格式、压缩包/解压后限制和包内入口检查状态。
- 单文件继续使用现有本地预览；ZIP 通过后端安全预检/临时运行预览后再生成截图，避免在浏览器重复实现 ZIP 解压安全规则。
- 状态明确显示：上传中、检查文件、解压资源、启动游戏、检测错误、生成封面、成功、等待审核和失败原因。
- 上传接口错误不再只显示通用失败文案。

## 统一入口

- GameHub 对外开发入口统一为 `http://127.0.0.1:9000/games`。
- `/games/upload` 是唯一投稿入口。
- `/videos/browse` 和其他未迁移的 PeerTube 前台入口重定向到 `/games`，不改变账号、管理和审核后台路由。
- 开发启动配置提供单一公共地址；内部前端热更新端口和 API 端口不暴露给用户。

## 兼容性

不修改现有游戏表的业务含义、账号体系、审核状态、社区互动接口和作者/创作中心数据。已有单文件游戏的 `runtimePath` 继续指向入口 HTML；资源包游戏的 `runtimePath` 指向其游戏目录内入口，更新时整目录替换。

## 验收

1. 真实浏览器从 `9000/games` 登录 `suweitao`，打开 `9000/games/upload`。
2. 上传带相对路径 JS/CSS/图片/音频的 ZIP，预览、截图、封面、发布、试玩全部成功。
3. 单文件 HTML 仍能上传和运行。
4. 缺少入口、外链资源、路径穿越、未知/危险扩展名、超过大小或文件数限制的包均被拒绝，并显示明确中文原因。
5. 现有游戏详情、评论、点赞、投币、收藏、作者关注和审核流程回归通过。
6. 服务端 tsc/Oxlint、前端 lint、专项 Mocha、生产构建和浏览器端响应式检查通过。
