# Game Cover Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 为无封面游戏接入按分类的预设背景，并将自动投稿封面收敛为 \`512×288\` 的压缩 JPG，同时保持手动封面不变。

**Architecture:** 在共享封面模块中维护分类归一化和静态资源 URL；展示层优先使用分类 JPG，静态 SVG 只作为资源异常时的最后兜底。投稿服务在浏览器 canvas 中加载预设或截图，绘制浅色标题板后输出 JPEG File；现有 API 和服务端存储协议不变。

**Tech Stack:** Angular 组件与 signal、TypeScript canvas/File API、Angular 静态 assets、Sharp 素材转换、Node 脚本校验、pnpm/PowerShell GameHub 自检。

---

### Task 1: 建立预设封面合同测试

**Files:**
- Modify: \`scripts/test-game-cover.ts\`
- Create: \`scripts/verify-game-cover-presets.mjs\`
- Modify: \`package.json\`

- [x] **Step 1: Write the failing shared-helper assertions**

在 \`scripts/test-game-cover.ts\` 中增加 \`getGameCoverPresetUrl\` 的导入和以下断言：

\`\`\`ts
assert.equal(
  getGameCoverPresetUrl('PUZZLE'),
  '/client/assets/images/game-cover-presets/puzzle.jpg',
  '分类预设 URL 必须归一化为小写'
)
assert.equal(
  getGameCoverPresetUrl('not-a-category'),
  '/client/assets/images/game-cover-presets/other.jpg',
  '未知分类必须使用 other 预设'
)
\`\`\`

\`package.json\` 增加 \`verify:game-cover-presets\` 脚本，调用 \`node ./scripts/verify-game-cover-presets.mjs\`，并让 \`verify:gamehub-client\` 在既有封面测试后调用它。

- [x] **Step 2: Run the focused test and observe the failure**

运行：

\`\`\`powershell
pnpm run test:game-cover
\`\`\`

预期：因为共享模块尚未导出 \`getGameCoverPresetUrl\`，测试以 TypeScript 导入错误失败。

- [x] **Step 3: Add the asset verifier contract**

\`scripts/verify-game-cover-presets.mjs\` 读取固定分类列表，逐个检查文件存在、前三个字节为 JPEG \`FF D8 FF\`、Sharp 元数据为 \`512×288\`，并断言文件大小不超过 \`120 * 1024\` 字节。失败时输出具体文件名和原因，成功时输出数量与总大小。

- [x] **Step 4: Run the verifier to confirm the asset gate is initially red**

运行：

\`\`\`powershell
pnpm run verify:game-cover-presets
\`\`\`

预期：素材尚未全部生成，脚本报告缺少预设文件并返回非零状态。

### Task 2: 接入分类预设 URL 与展示层兜底

**Files:**
- Modify: \`client/src/app/shared/game-cover.ts\`
- Modify: \`client/src/app/+games/game-card.component.ts\`
- Modify: \`client/src/app/+games/games-home/featured-carousel.component.ts\`
- Modify: \`client/src/app/+games/game-rankings.component.ts\`
- Modify: \`client/src/app/+games/game-reservations.component.ts\`
- Modify: \`client/src/app/+games/game-watch-later.component.ts\`
- Modify: \`client/src/app/+games/game-play.component.ts\`
- Modify: \`client/src/app/header/header.component.ts\`
- Modify: \`scripts/verify-gamehub-client.mjs\`
- Modify: \`scripts/verify-gamehub-style.mjs\`

- [x] **Step 1: Implement the pure category resolver**

在 \`game-cover.ts\` 中导出固定分类集合和：

\`\`\`ts
export function getGameCoverPresetUrl (category = 'other') {
  const normalized = category.trim().toLowerCase()
  const preset = GAME_COVER_PRESET_CATEGORIES.includes(normalized as GameCoverPresetCategory)
    ? normalized
    : 'other'
  return \`/client/assets/images/game-cover-presets/\${preset}.jpg\`
}
\`\`\`

同时保留 \`buildGameCoverDataUrl\`，供资源加载错误时同步生成最终兜底。

- [x] **Step 2: Make cards and carousel prefer the preset asset**

将 \`GameCardComponent.generatedCoverUrl()\` 与 \`FeaturedCarouselComponent.featuredCoverPath()\` 的无封面返回值改为 \`getGameCoverPresetUrl(game.category)\`。展示层继续在已有封面 URL 成功时优先使用服务器图片；为预设错误增加一次 SVG fallback，避免把同一个坏 URL 重复绑定。

- [x] **Step 3: Update secondary game surfaces**

把排行、预约、稍后再玩、详情页相关游戏和顶部动态预览的无封面分支统一改为 \`getGameCoverPresetUrl\`；稍后再玩历史数据没有 category 时自然落到 \`other\`。已有的错误信号仍保留，错误后使用 \`buildGameCoverDataUrl\`，以保证本地降级不依赖静态资源。

- [x] **Step 4: Update structural checks**

把两个静态校验脚本中“所有展示位必须包含 \`buildGameCoverDataUrl\`”的断言改为检查 \`getGameCoverPresetUrl\`；保留对共享 SVG fallback 的断言，并新增生成器必须包含 \`.jpg\`、\`image/jpeg\`、\`512\`、\`288\` 和 \`0.78\` 的合同。

- [x] **Step 5: Run focused helper and structural checks**

运行：

\`\`\`powershell
pnpm run test:game-cover
pnpm run verify:gamehub-style
\`\`\`

预期：共享 helper 测试通过；静态检查在素材生成前可能只剩预设资源校验失败，源码合同本身通过。

### Task 3: 生成并校验分类背景素材

**Files:**
- Create: \`client/src/assets/images/game-cover-presets/*.jpg\`（16 个固定分类素材）

- [x] **Step 1: Generate each distinct category background with ImageGen**

每张图使用 16:9、无文字/Logo/水印、低饱和浅色内容平台风格，针对分类加入抽象但不具象的视觉线索，并给左下或中下区域留标题安全区。Puzzle 使用已经确认的几何拼图背景；其余分类逐张生成，避免把同一张图伪装成多个分类。

- [x] **Step 2: Convert sources into repository assets**

用已安装的 Sharp 将每个生成源图以 \`fit: 'cover'\` 裁切并输出 \`512×288\`、JPEG quality \`78\`、启用 \`mozjpeg\` 的文件，只把 JPG 复制到 \`client/src/assets/images/game-cover-presets/\`，不提交源 PNG。

- [x] **Step 3: Run the media verifier**

运行：

\`\`\`powershell
pnpm run verify:game-cover-presets
\`\`\`

预期：16/16 通过 JPEG、尺寸和单文件体积检查。

### Task 4: 将自动生成链路改为 512×288 JPG

**Files:**
- Modify: \`client/src/app/+games/services/cover-generator.service.ts\`
- Modify: \`scripts/test-game-cover.ts\`
- Modify: \`scripts/verify-gamehub-client.mjs\`

- [x] **Step 1: Add canvas/file contract coverage**

在纯测试中保留手动封面不经 helper 的现有投稿断言，并在结构校验中截取 \`generateAutomaticCover\` 与 \`coverFromScreenshot\` 源码，检查两者都输出 \`gamehub-*.jpg\`、\`image/jpeg\`，并设置 \`canvas.width = 512\`、\`canvas.height = 288\`。

- [x] **Step 2: Implement preset composition**

\`generateAutomaticCover\` 加载 \`getGameCoverPresetUrl(category)\`，图片加载失败时加载 \`buildGameCoverDataUrl(title, category)\`；canvas 使用 \`512×288\`，背景按 cover 方式绘制，底部绘制半透明浅色标题板，标题最多两行并做省略，最终：

\`\`\`ts
canvas.toBlob(blob => {
  resolve(blob ? new File([ blob ], 'gamehub-auto-cover.jpg', { type: 'image/jpeg' }) : null)
}, 'image/jpeg', 0.78)
\`\`\`

\`coverFromScreenshot\` 使用同样的 canvas 尺寸和 JPEG 输出，保留截图填充与标题，但将黑色渐变替换为浅色半透明标题板。

- [x] **Step 3: Run focused tests and client verification**

运行：

\`\`\`powershell
pnpm run test:game-cover
pnpm run verify:gamehub-client
\`\`\`

预期：helper、资源、源码合同和 locale 检查全部通过。

### Task 5: 文档、构建与真实运行验收

**Files:**
- Modify: \`README.md\`
- Modify: \`docs/releases/release-notes.md\`

- [x] **Step 1: Update user-facing release notes**

在现有最新更新位置增加“按游戏分类生成轻量 JPG 预览图”的说明，明确 \`512×288\`、压缩 JPG、无封面历史游戏的分类背景和手动封面保持不变。

- [x] **Step 2: Run focused build and lint checks**

运行：

\`\`\`powershell
git diff --check
pnpm run build:client:light
pnpm run lint
\`\`\`

预期：命令完成且退出码为 0；dist 中包含 \`assets/images/game-cover-presets/*.jpg\`。

- [x] **Step 3: Run the complete GameHub gate**

运行：

\`\`\`powershell
pnpm run self-test:gamehub
\`\`\`

预期：server/client 构建、lint、源码校验、SPA/API 冒烟和懒加载资源检查全部通过。

- [ ] **Step 4: Verify the live page in the Codex built-in browser**（未执行：当前会话未暴露内置浏览器控制能力；未切换到其他浏览器工具。）

从 \`develop\` 工作区启动或连接本地服务，用内置浏览器打开 \`/games\`，确认无封面卡片请求分类 JPG，投稿预览显示标题且无黑色遮罩；通过浏览器网络/DOM 观察确认已有封面仍然使用原 URL。若当前会话没有暴露内置浏览器，明确记录该项为阻塞，不切换到其他浏览器工具。

- [x] **Step 5: Commit, merge, push, and clean up**

提交前检查状态只包含预期文件，然后执行：

\`\`\`powershell
git commit -s -m \"优化分类游戏预览图\"
git -C D:\\Github\\GameHub merge --ff-only codex/game-cover-presets
git -C D:\\Github\\GameHub push origin develop
git -C D:\\Github\\GameHub worktree remove D:\\Github\\_worktrees\\GameHub\\game-cover-presets
git -C D:\\Github\\GameHub branch -d codex/game-cover-presets
git -C D:\\Github\\GameHub worktree prune
\`\`\`

最后重新检查 \`develop\` 与 \`origin/develop\` SHA 相同、功能分支已进入 \`develop\`、worktree 目录不存在、主工作区干净。
