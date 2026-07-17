# GameHub HTML 游戏资源包上传实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持安全的单文件 HTML 与 ZIP 资源包上传，并从统一的 GameHub 入口完成预览、截图、发布和试玩。

**Architecture:** 以资源包目录作为运行时边界，单文件 HTML 在存储时也规范化为同样的入口目录结构。后端负责解压、路径/扩展名/HTML 引用校验和资源服务，前端负责格式引导、状态呈现和预览交互；原有游戏记录、审核和社区 API 保持不变。

**Tech Stack:** Node.js 22、Express、TypeScript、Sequelize、yauzl、Angular、Mocha、Playwright/CDP。

---

### Task 1: 建立资源包验证的失败测试

**Files:**
- Modify: `packages/tests/src/api/games/game-runtime.ts`
- Test: `server/core/lib/games/game-runtime.ts`

- [ ] 添加单文件 MIME 容错、ZIP 根目录 `index.html`、相对资源引用、路径穿越、外链资源、危险扩展名、重复入口、文件数量和解压大小测试。
- [ ] 使用 `JSZip` 在测试中生成内存 ZIP，并断言失败错误包含稳定的英文错误码/消息键，控制器层再映射成中文。
- [ ] 运行 `pnpm exec mocha --import tsx --timeout 30000 packages/tests/src/api/games/game-runtime.ts`，确认新增用例在实现前失败。

### Task 2: 实现资源包解析、验证和原子存储

**Files:**
- Modify: `server/core/lib/games/game-runtime.ts`
- Modify: `server/core/helpers/unzip.ts`（仅在需要时补齐安全路径/重复条目行为）
- Test: `packages/tests/src/api/games/game-runtime.ts`

- [ ] 定义 `GameRuntimePackage`、`GameRuntimeValidationError` 和统一存储结果类型。
- [ ] 实现 ZIP 入口、路径规范化、扩展名白名单、重复路径、文件数量、压缩大小和解压后大小检查。
- [ ] 解压到随机临时目录，验证所有 HTML/CSS 引用，再将完整目录原子移动到随机运行目录；任意异常清理临时目录和已创建目录。
- [ ] 让单文件 HTML 走同一资源包结果结构，文件大小记录为运行目录总大小。
- [ ] 为资源读取提供 `readStoredGameRuntimeFile`，只接受相对路径和允许的运行时文件。
- [ ] 运行 Task 1 测试，确认全部通过。

### Task 3: 接入创建/更新 API 与中文错误

**Files:**
- Modify: `server/core/controllers/api/games/index.ts`
- Modify: `server/core/controllers/api/games/runtime.ts`
- Test: `packages/tests/src/api/games/games.ts`

- [ ] 让 multipart `gamefile` 接受 HTML 和 ZIP 扩展名，不因浏览器通用 MIME 拒绝合法文件。
- [ ] 创建和更新共用资源包存储函数，配额按解压后总大小计算，失败时清理整个运行目录。
- [ ] 将已知验证错误转换为 400 中文响应，将配额冲突转换为 409 中文响应。
- [ ] 增加 `/runtime/*` 资源路由，基于白名单返回 Content-Type、CSP 和防遍历响应头。
- [ ] 增加 API 用例覆盖 HTML、ZIP 成功路径和四类拒绝路径。

### Task 4: 统一开发入口

**Files:**
- Modify: `client/src/app/+games/routes.ts`
- Modify: `client/src/app/header/game-navigation.component.ts`
- Modify: `client/src/app/header/header.component.ts`
- Modify: `client/proxy.game-community.config.ts`
- Modify: `support/doc/development/game-community.md`（如文件不存在则创建）

- [ ] 将 `/games` 设为唯一用户入口，旧的 `/videos/browse` 前台路径重定向到 `/games`。
- [ ] 将开发配置整理为一个用户访问地址 `http://127.0.0.1:9000`，内部前端/API 端口只由代理使用。
- [ ] 更新启动命令和文档，明确用户不需要打开 4300、9010 或旧工作区服务。
- [ ] 添加入口路由回归测试，确认 `/games`、`/games/upload` 和旧视频入口行为。

### Task 5: 更新上传页和预览状态

**Files:**
- Modify: `client/src/app/+games/game-upload.component.ts`
- Modify: `client/src/app/+games/game-upload.component.html`
- Modify: `client/src/app/+games/game-upload.component.scss`
- Modify: `client/src/app/+games/games.service.ts`

- [ ] 文件选择器接受 `.html,.htm,.zip`，显示压缩包限制与资源包结构说明。
- [ ] 提交时显示阶段状态和 API 返回的中文失败原因，防止重复提交。
- [ ] 为 ZIP 预览接入安全预检/临时运行结果，继续复用现有截图封面流程。
- [ ] 确认运行 iframe 的相对资源请求命中 `/runtime/*`，并在加载失败时显示可操作错误。
- [ ] 保持单文件 HTML 的现有封面、截图和表单字段行为。

### Task 6: 真实浏览器和回归验收

**Files:**
- Modify: `packages/tests/src/client/games-api.ts`（如新增请求契约）
- Create: `packages/tests/src/api/games/game-package-fixtures.ts`（如测试夹具需要）

- [ ] 启动统一入口，使用 `suweitao / suweitao` 登录。
- [ ] 真实上传相对资源 ZIP，完成预览、截图、发布并打开试玩，确认资源请求和游戏交互成功。
- [ ] 逐项验证缺少入口、外链、路径穿越、危险扩展名、超大 ZIP 和超多文件均被拒绝。
- [ ] 回归游戏详情、评论、点赞、投币、收藏、作者页、创作中心和审核接口。
- [ ] 运行 `pnpm run tsc -b server/tsconfig.json`、`pnpm run oxlint`、`pnpm --dir client run lint-ts`、专项 Mocha 和 Angular 生产构建。
- [ ] 运行 `git diff --check`，提交并推送分支。
