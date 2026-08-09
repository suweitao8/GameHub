# HTML 游戏快速投稿实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GameHub 投稿压缩为选择一个 HTML 文件即可提交，同时让创建 API 在缺少元数据时自动补齐默认值。

**Architecture:** 上传页只负责文件选择、快速格式反馈和提交状态；`GamesService` 允许文件-only multipart 请求；服务端创建路由在既有校验前补齐标题、分类和空元数据，更新路由保持完整编辑契约。现有 HTML 安全校验、限流、配额、审核和编辑页不变。

**Tech Stack:** Angular 22 standalone component、TypeScript、Express/Sequelize、Mocha/Chai、OpenAPI YAML、PowerShell 自测试脚本。

---

## 文件边界

- Modify `client/src/app/+games/game-upload.component.ts`: 删除上传页对预览探针和表单字段的依赖，保留文件生命周期、自动标题/封面、提交状态和成功链接。
- Modify `client/src/app/+games/game-upload.component.html`: 改为一个可点击、可拖拽、可键盘触发的单文件上传卡片。
- Modify `client/src/app/+games/game-upload.component.scss`: 删除步骤、字段和预览样式，补齐上传区的 hover/focus/drag/loading/error/success/响应式样式。
- Modify `client/src/app/+games/games-api.ts`: 让 `GameUploadMetadata` 和表单构造器支持可选元数据及 file-only 请求。
- Modify `client/src/app/+games/games.service.ts`: 让 `create(file, metadata?)` 的元数据参数可省略。
- Modify `server/core/lib/games/game-runtime.ts`: 增加从 HTML title 或文件名生成安全默认标题的纯函数。
- Modify `server/core/controllers/api/games/game-crud-create.ts`: 在创建校验前补齐默认元数据。
- Modify `packages/tests/src/client/games-api.ts`: 守护 file-only multipart 和完整元数据 multipart 的兼容性。
- Modify `packages/tests/src/api/games/games-api.ts`: 守护仅上传 `gamefile` 的创建流程和标题/空元数据默认值。
- Modify `scripts/verify-gamehub-client.mjs`: 将旧的上传预览/手动封面静态断言替换为快速投稿入口断言。
- Modify `support/doc/api/openapi.yaml`: 将创建请求的必填字段改为只有 `gamefile`，说明默认元数据规则。
- Modify `support/doc/development/game-community.md`: 说明投稿页只需单个 HTML，元数据可在编辑页补充。

## Task 1: 创建隔离 worktree 并确认基线

**Files:**

- Create worktree: `D:/Github/_worktrees/GameHub/simplify-html-upload`
- Branch: `codex/simplify-html-upload` from `develop`

- [ ] **Step 1: 检查当前基线与 worktree 所有权**

Run from `D:/Github/GameHub`:

```powershell
git status --short --branch
git branch --show-current
git worktree list --porcelain
```

Expected: `develop` is clean except for no uncommitted files, and the existing `remove-nav-background` worktree remains registered and untouched.

- [ ] **Step 2: 创建任务 worktree**

```powershell
git worktree add 'D:/Github/_worktrees/GameHub/simplify-html-upload' -b 'codex/simplify-html-upload' develop
```

Expected: the new worktree is registered on `codex/simplify-html-upload` without changing or removing any other worktree.

- [ ] **Step 3: 在 worktree 中确认依赖和基线**

```powershell
Set-Location 'D:/Github/_worktrees/GameHub/simplify-html-upload'
pnpm install --frozen-lockfile
pnpm run build:server
pnpm run build:client
```

Expected: both builds pass before feature edits. If the repository already has a baseline failure, record the exact command and output before continuing.

## Task 2: 先为 file-only 客户端请求写失败契约测试

**Files:**

- Modify: `packages/tests/src/client/games-api.ts`
- Modify: `client/src/app/+games/games-api.ts` only after the failing test is observed
- Modify: `client/src/app/+games/games.service.ts` only after the failing test is observed

- [ ] **Step 1: 添加 file-only 表单测试**

在现有 `does not serialize File metadata as an unexpected multipart field` 测试后添加：

```typescript
  it('builds a multipart request with only the game file for quick uploads', function () {
    const game = new File([ '<!doctype html><title>Quick game</title>' ], 'quick-game.html', { type: 'text/html' })
    const form = buildGameUploadFormData(game)

    expect(Array.from(form.keys())).to.deep.equal([ 'gamefile' ])
    expect(form.get('gamefile')).to.be.instanceOf(File)
  })
```

- [ ] **Step 2: 运行测试编译，确认它因旧签名失败**

```powershell
pnpm exec tsc -p packages/tests/tsconfig.json --noEmit
```

Expected: FAIL with a TypeScript error indicating that `buildGameUploadFormData` requires a metadata argument. This confirms the new test exercises the missing contract.

- [ ] **Step 3: 实现最小 file-only API**

在 `games-api.ts` 将类型和构造器改为：

```typescript
export type GameUploadMetadata = {
  title?: string
  description?: string
  instructions?: string
  category?: string
  tags?: string
  cover?: File | null
}

export function buildGameUploadFormData (file: File, metadata: GameUploadMetadata = {}) {
  const body = new FormData()
  body.append('gamefile', file, file.name)
  if (metadata.cover) body.append('coverfile', metadata.cover, metadata.cover.name)
  if (metadata.title !== undefined) body.append('title', metadata.title)
  if (metadata.description !== undefined) body.append('description', metadata.description)
  if (metadata.instructions !== undefined) body.append('instructions', metadata.instructions)
  if (metadata.category !== undefined) body.append('category', metadata.category)
  if (metadata.tags !== undefined) body.append('tags', metadata.tags)
  return body
}
```

在 `GamesService` 将方法签名改为：

```typescript
create (file: File, metadata: GameUploadMetadata = {}): Observable<Game> {
  const body = buildGameUploadFormData(file, metadata)
  return this.http.post<Game>(GamesService.BASE_URL, body).pipe(map(normalizeGame))
}
```

- [ ] **Step 4: 运行客户端契约测试并确认通过**

```powershell
pnpm exec tsc -p packages/tests/tsconfig.json --noEmit
```

Expected: PASS, including the original complete metadata + cover field-order assertion.

- [ ] **Step 5: 提交客户端 API 契约变更**

```powershell
git add packages/tests/src/client/games-api.ts client/src/app/+games/games-api.ts client/src/app/+games/games.service.ts
git commit -m 'feat(gamehub): 支持仅上传文件的游戏创建请求'

## Task 3: 先为服务端默认标题与 file-only 创建写失败测试

**Files:**

- Modify: `packages/tests/src/api/games/games-api.ts`
- Modify: `server/core/lib/games/game-runtime.ts` only after a failing test
- Modify: `server/core/controllers/api/games/game-crud-create.ts` only after a failing test

- [ ] **Step 1: 添加仅文件上传测试辅助函数**

在现有 `uploadGame` 辅助函数后添加：

```typescript
  async function uploadGameWithDefaults (server: PeerTubeServer, token: string) {
    const body = new FormData()
    body.append('gamefile', new Blob([ sampleHtml ]), 'quick-game.html')

    return fetch(`${server.url}/api/v1/games`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body
    })
  }
```

在 `should upload a game` 测试前添加：

```typescript
    it('should upload a game with only an HTML file', async function () {
      const res = await uploadGameWithDefaults(server, userAccessToken)

      expect(res.status).to.equal(HttpStatusCode.CREATED_201)
      const game = await res.json()
      expect(game.title).to.equal('Test')
      expect(game.description).to.equal('')
      expect(game.instructions).to.equal('')
      expect(game.category).to.equal('other')
      expect(game.tags).to.deep.equal([])
    })
```

The fixture title is already `<title>Test</title>`, so the test proves HTML title precedence over `quick-game` filename fallback.

- [ ] **Step 2: 构建测试并运行专项 API 测试，确认它因必填元数据失败**

```powershell
pnpm run build:server
pnpm run build:tests
pnpm run mocha -- --timeout 120000 --exit --bail packages/tests/dist/api/games/games-api.js
```

Expected: the new test fails with a 4xx validation response because the old route requires `title` and `category`.

- [ ] **Step 3: 为运行时增加默认标题函数**

在 `server/core/lib/games/game-runtime.ts` 的 `GameRuntimeValidationError` 后添加：

```typescript
export function deriveGameTitle (filename: string, content: Buffer) {
  const documentTitle = parse(content.toString('utf8')).querySelector('title')?.text.trim()
  const filenameTitle = basename(filename, extname(filename)).replace(/[_.-]+/g, ' ').trim()
  const candidate = documentTitle || filenameTitle || '未命名游戏'
  const safeTitle = candidate
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return (safeTitle || '未命名游戏').slice(0, 120)
}
```

- [ ] **Step 4: 在创建校验前补齐默认字段**

在 `game-crud-create.ts` 中导入 `deriveGameTitle`，并将创建路由改为：

```typescript
createRouter.post('/', authenticate, gameUploadRateLimiter, gameFile, applyGameCreateDefaults, gameCreateValidator, asyncMiddleware(createGame))
```

在 `previewGame` 前添加：

```typescript
async function applyGameCreateDefaults (req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    req.body ||= {}
    const file = req.files?.['gamefile']?.[0]
    if (!req.body.title?.trim() && file) {
      req.body.title = deriveGameTitle(file.originalname, await readFile(file.path))
    }
    if (req.body.description === undefined) req.body.description = ''
    if (req.body.instructions === undefined) req.body.instructions = ''
    if (req.body.category === undefined || !req.body.category.trim()) req.body.category = 'other'
    if (req.body.tags === undefined) req.body.tags = ''
    next()
  } catch (error) {
    next(error)
  }
}
```

- [ ] **Step 5: 运行专项 API 测试确认服务端变绿**

```powershell
pnpm run build:server
pnpm run build:tests
pnpm run mocha -- --timeout 120000 --exit --bail packages/tests/dist/api/games/games-api.js
```

Expected: the new file-only test and all existing game API tests pass.

- [ ] **Step 6: 提交服务端默认值变更**

```powershell
git add packages/tests/src/api/games/games-api.ts server/core/lib/games/game-runtime.ts server/core/controllers/api/games/game-crud-create.ts
git commit -m 'feat(gamehub): 允许仅凭 HTML 文件创建游戏'
```

## Task 4: 先更新静态验证断言，再实现极简上传页面

**Files:**

- Modify: `scripts/verify-gamehub-client.mjs`
- Modify: `client/src/app/+games/game-upload.component.ts`
- Modify: `client/src/app/+games/game-upload.component.html`
- Modify: `client/src/app/+games/game-upload.component.scss`

- [ ] **Step 1: 将旧上传流程断言替换为快速投稿断言**

删除 `scripts/verify-gamehub-client.mjs` 中要求上传页存在 `onPreviewLoaded`、`previewGeneration`、手动封面清理、`previewValidationError` 和旧表单字段的断言，保留对独立 `previewProbeTs` 服务本身的回归断言。

在相同位置添加以下断言：

```javascript
assert(
  uploadHtml.includes('accept=".html,.htm,text/html,application/xhtml+xml"') &&
    uploadHtml.includes('dragover') && uploadHtml.includes('onFileDrop') &&
    uploadHtml.includes('keydown') && uploadHtml.includes('提交游戏'),
  'game upload must expose a single HTML drop zone with click, drag, and keyboard submission paths'
)
assert(
  uploadHtml.includes('文件大小') && uploadHtml.includes('移除文件') &&
    uploadHtml.includes('正在上传并检查') && uploadHtml.includes('打开游戏'),
  'game upload must expose file state, loading feedback, and a success link'
)
assert(
  !uploadHtml.includes('upload-steps') && !uploadHtml.includes('upload-preview-frame') &&
    !uploadHtml.includes('name="description"') && !uploadHtml.includes('name="instructions"') &&
    !uploadHtml.includes('name="category"') && !uploadHtml.includes('name="tags"') &&
    !uploadHtml.includes('coverfile'),
  'quick game upload must not expose the old metadata, preview, or manual cover controls'
)
assert(
  uploadTs.includes('isSupportedGameRuntimeFilename') &&
    uploadTs.includes('20 * 1024 * 1024') &&
    uploadTs.includes('this.gamesService.create(file, '),
  'quick game upload must validate the single HTML limit and submit without required metadata'
)
```

- [ ] **Step 2: 运行静态验证，确认它因旧页面结构失败**

```powershell
pnpm run verify:gamehub-client
```

Expected: FAIL at the new quick-upload assertions because the current page still contains the old step/form structure.

- [ ] **Step 3: 实现组件逻辑**

将 `game-upload.component.ts` 收敛为以下行为：

```typescript
import { ChangeDetectionStrategy, Component, HostListener, inject, OnDestroy, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { Game, GamesService } from './games.service'
import { isSupportedGameRuntimeFilename } from './games-api'
import { CoverGeneratorService } from './services/cover-generator.service'

// 保留 file、submitting、error、message、createdGame、fileSize、dragActive 等状态；
// 移除 previewProbe、steps、可编辑元数据和手动封面状态。
```

`prepareSelectedFile` 必须清空旧文件和结果，拒绝非 HTML 或超过 20MB 的文件；接受文件后用 `File.text()` 读取 `<title>`，失败或标题不安全时使用文件名去扩展名，作为内部标题和自动封面文字。`submit` 只在文件存在且未提交时执行：先固定当前文件并等待标题读取完成，尝试调用 `generateAutomaticCover(title)`，然后调用 `this.gamesService.create(file, { title, category: 'other', description: '', instructions: '', tags: '', cover })`；封面生成返回 `null` 或抛错时仍调用 `create`，错误通过现有 `getUploadError` 映射。

实现键盘和拖拽入口：

```typescript
onFilePickerKeydown (event: KeyboardEvent, input: HTMLInputElement) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  input.click()
}

onFileDrop (event: DragEvent) {
  this.dragActive.set(false)
  const files = event.dataTransfer?.files
  if (!files?.length) return
  if (files.length > 1) {
    this.error.set('一次只能投稿一个 HTML 文件。')
    return
  }
  this.prepareSelectedFile(files[0])
}
```

`@HostListener('window:beforeunload')` 只在有文件、未提交且未成功时提示；移除方法在清空文件时重置所有错误和成功状态。

- [ ] **Step 4: 实现单卡片模板**

模板必须包含：

```html
<div class="upload-drop-zone" role="button" tabindex="0"
  (click)="fileInput.click()"
  (keydown)="onFilePickerKeydown($event, fileInput)"
  (dragover)="$event.preventDefault(); dragActive.set(true)"
  (dragleave)="$event.preventDefault(); dragActive.set(false)"
  (drop)="$event.preventDefault(); onFileDrop($event)">
  <input #fileInput type="file" accept=".html,.htm,text/html,application/xhtml+xml"
    (change)="onFileChange($event)">
  <strong>拖拽 HTML 文件到这里</strong>
  <span>或点击选择，最大 20MB</span>
</div>
```

选中文件后显示文件名、`文件大小`、标题提示和 `移除文件` 按钮；提交按钮使用 `[disabled]="submitting() || !file || !!createdGame()"`，提交中显示 `正在上传并检查…`，成功后显示 `已提交`；成功状态显示审核文案与 `[routerLink]="['/games', game.uuid]"` 的 `打开游戏`。

- [ ] **Step 5: 实现上传区状态样式**

在 SCSS 中覆盖 `:hover`、`:focus-visible`、`.dragover`、`:disabled`、`.loading`、`.form-error`、`.form-success` 和窄屏布局；交互目标至少 44px 高，颜色使用现有 `--game-*` token。删除旧 `.upload-steps`、`.field-grid`、`.upload-preview-frame`、封面编辑和表单字段样式。

- [ ] **Step 6: 运行静态验证并确认页面结构变绿**

```powershell
pnpm run verify:gamehub-client
pnpm --dir client run lint-ts -- src/app/+games/game-upload.component.ts
pnpm --dir client run lint-scss -- src/app/+games/game-upload.component.scss
```

Expected: quick-upload assertions pass and the changed component files pass lint.

- [ ] **Step 7: 提交极简上传页**

```powershell
git add scripts/verify-gamehub-client.mjs client/src/app/+games/game-upload.component.ts client/src/app/+games/game-upload.component.html client/src/app/+games/game-upload.component.scss
git commit -m 'feat(gamehub): 简化 HTML 游戏投稿页面'

## Task 5: 同步 OpenAPI、开发文档并补齐契约检查

**Files:**

- Modify: `support/doc/api/openapi.yaml`
- Modify: `support/doc/development/game-community.md`
- Modify: `scripts/verify-gamehub-client.mjs` if its OpenAPI assertions need exact wording updates

- [ ] **Step 1: 更新创建接口文档**

在 `support/doc/api/openapi.yaml` 的 `/api/v1/games` `post` multipart schema 中，将：

```yaml
required: [title, category, gamefile]
```

改为：

```yaml
required: [gamefile]
```

并在 description 中说明：缺省标题从 HTML `<title>` 或文件名推导，分类默认为 `other`，简介/操作说明/标签为空；更新接口描述不变。

- [ ] **Step 2: 更新开发入口文档**

在 `support/doc/development/game-community.md` 的游戏包格式和上传页说明中，明确“投稿只需单个 `.html`/`.htm` 文件，元数据可在创建后通过编辑页补充”，并保留 20MB、禁止 ZIP 和安全限制。

- [ ] **Step 3: 运行 OpenAPI 校验和 diff 检查**

```powershell
pnpm run swagger-cli -- validate support/doc/api/openapi.yaml
git diff --check
```

Expected: OpenAPI validation passes and no whitespace errors are reported.

- [ ] **Step 4: 提交契约与文档变更**

```powershell
git add support/doc/api/openapi.yaml support/doc/development/game-community.md scripts/verify-gamehub-client.mjs
git commit -m 'docs(gamehub): 更新快速投稿接口契约'
```

## Task 6: 全量构建、专项测试和真实浏览器验证

**Files:**

- No new source files; inspect all changes and generated artifacts only.

- [ ] **Step 1: 运行完整质量门禁**

```powershell
pnpm run build:server
pnpm run build:client
pnpm run lint
pnpm run swagger-cli -- validate support/doc/api/openapi.yaml
pnpm run verify:gamehub-client
pnpm run build:tests
```

Expected: all commands pass. Do not commit `dist/`, logs, screenshots, local config, or database files.

- [ ] **Step 2: 启动依赖和服务并验证 API 入口**

```powershell
docker compose -f support/docker/development/docker-compose.yml up -d
$env:NODE_ENV = 'dev'
$env:NODE_CONFIG = '{"redis":{"port":6381}}'
pnpm run start
```

In another PowerShell process:

```powershell
Invoke-WebRequest 'http://127.0.0.1:9000/api/v1/ping'
Invoke-WebRequest 'http://127.0.0.1:9000/games/upload'
```

Expected: ping returns a successful response and the upload route returns the SPA entry without startup-level errors.

- [ ] **Step 3: 使用真实浏览器验证投稿页**

At `http://127.0.0.1:9000/games/upload`, verify:

1. No step bar, metadata form, preview iframe, or manual cover input is visible.
2. Clicking the drop zone opens the file picker; keyboard focus is visible and Enter/Space opens it.
3. Dropping one valid HTML file shows its name and file size; dragging highlights the zone.
4. Dropping multiple files, a non-HTML file, or an oversized file shows an actionable Chinese error and does not enable submit.
5. Submit shows disabled/loading state and prevents a second click.
6. A valid authenticated upload shows published/pending feedback and an `打开游戏` link; a server rejection shows its concrete error.
7. The layout remains usable at a narrow mobile viewport with no horizontal overflow.

- [ ] **Step 4: 运行项目最终自测**

```powershell
pnpm run self-test:gamehub
```

Expected: build, server/client lint, changed-client checks, bundle checks, API ping, SPA entry, and lazy scripts all pass.

- [ ] **Step 5: 做提交前收尾检查**

```powershell
git diff --check
git status --short --branch
git branch --show-current
git log -1 --oneline --decorate
git worktree list --porcelain
```

Expected: only intended source/test/docs files are changed in the task worktree; no generated artifacts or unrelated worktree changes are present.

## Task 7: 合并到 develop、推送并清理任务 worktree

**Files:**

- No source changes; Git integration and cleanup only.

- [ ] **Step 1: 确认任务分支提交完整且可合并**

From the task worktree:

```powershell
git status --short
git log --oneline --decorate -5
git diff develop...HEAD --stat
```

Expected: clean task worktree and only the approved quick-upload changes plus the design commit are present.

- [ ] **Step 2: 合并到 develop**

From `D:/Github/GameHub`:

```powershell
git fetch origin --prune
git merge --ff-only codex/simplify-html-upload
```

If fast-forward is unavailable because `origin/develop` advanced, update local `develop` safely and resolve only this task's conflicts before rerunning all relevant checks.

- [ ] **Step 3: 推送主分支并确认远程同步**

```powershell
git push origin develop
git fetch origin --prune
$localDevelop = git rev-parse develop
$remoteDevelop = git rev-parse origin/develop
if ($localDevelop -ne $remoteDevelop) { throw 'develop 尚未与 origin/develop 同步' }
```

Expected: local and remote `develop` point to the same commit.

- [ ] **Step 4: 删除当前任务 worktree，不碰其他 worktree**

```powershell
git worktree remove 'D:/Github/_worktrees/GameHub/simplify-html-upload'
git worktree prune
Test-Path 'D:/Github/_worktrees/GameHub/simplify-html-upload'
```

Expected: the command returns `False`; `D:/Github/_worktrees/GameHub/remove-nav-background` remains registered and untouched.

- [ ] **Step 5: 在 develop 做最终收尾审计**

```powershell
Set-Location 'D:/Github/GameHub'
git status --short --branch
git branch --show-current
git log -1 --oneline --decorate
git worktree list --porcelain
git merge-base --is-ancestor codex/simplify-html-upload develop
```

Expected: current branch is `develop`, the task branch is an ancestor, the working tree is clean, and no task worktree directory remains. Report any pre-existing service that was intentionally left running separately.
