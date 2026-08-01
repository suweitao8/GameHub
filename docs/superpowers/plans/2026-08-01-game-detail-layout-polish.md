# GameHub 游戏详情页布局优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 GameHub 游戏详情页的 SVG 污染、间距、对齐和响应式布局问题。

**Architecture:** 保留现有 Angular 组件和 API，只在详情页宿主样式、讨论群/互动组件的局部样式和静态客户端契约中做最小改动。页面使用共享的 CSS 间距变量、4:1 网格和固定基线尺寸，避免继续增加重复布局规则。

**Tech Stack:** Angular 22、SCSS、Tabler outline SVG、PowerShell 自测脚本、应用内浏览器。

---

### Task 1: 锁定 SVG 资源污染回归

**Files:**
- Modify: `scripts/verify-gamehub-client.mjs`
- Modify: `client/src/assets/images/tabler/*.svg`

- [x] **Step 1: 写失败契约**：遍历 Tabler SVG，要求每个文件以 `<svg` 开头且不包含 `Exit code`、`Wall time`、`Output:`。
- [x] **Step 2: 运行契约确认失败**：`pnpm run verify:gamehub-client` 已稳定复现 23 个污染资源失败。
- [x] **Step 3: 修复资源**：从官方 Tabler npm 包中截取 `<svg>...</svg>`，清除命令包装输出，使用 `apply_patch` 写回资源。
- [x] **Step 4: 运行契约确认通过**：`pnpm run verify:gamehub-client` 应输出 `verify-gamehub-client OK`。

### Task 2: 收敛详情页布局和统计基线

**Files:**
- Modify: `client/src/app/+games/game-play.component.html`
- Modify: `client/src/app/+games/game-play.component.scss`

- [x] **Step 1: 修改统计文本**：保留 `aria-label`，显示图标和数字，删除“游玩/评论”重复文本。
- [x] **Step 2: 写宿主布局规则**：加入 `--game-detail-gap: 16px`、`box-sizing`、1280px 最大宽度、4:1 网格、桌面/窄屏游戏高度和统一开发者基线。
- [ ] **Step 3: 构建后检查布局**：确认 `.game-title-bar`、`.game-stage-row` 使用相同列模板和 gap，讨论群顶部与游戏区域顶部对齐。

### Task 3: 收敛互动栏与讨论群控件

**Files:**
- Modify: `client/src/app/+games/game-community-panel.component.ts`
- Modify: `client/src/app/+games/game-discuss.component.ts`

- [x] **Step 1: 简化互动栏**：点赞/投币/收藏/分享改为图标与相邻数字或文字的单行结构，并保留无障碍标签。
- [x] **Step 2: 统一讨论群尺寸**：使用 48px 头部、12px 内容间距、32px 头像、52px 输入区和 32px 发送按钮。
- [ ] **Step 3: 运行客户端 lint**：确保 Angular 模板和组件内 SCSS 通过检查。

### Task 4: 构建、浏览器验证和交付

**Files:**
- No additional source files.

- [ ] **Step 1: 运行完整门禁**：`pnpm run self-test:gamehub -- -SkipLive`。
- [ ] **Step 2: 重启主工作区固定 9000 服务**，验证 `/api/v1/ping` 返回 `200 pong`。
- [ ] **Step 3: 运行 live 门禁**：`pnpm run self-test:gamehub -- -SkipBuild -SkipLint`。
- [ ] **Step 4: 浏览器验证**：检查详情页 Tabler SVG、标题/游戏/讨论群边界、互动栏高度和 600px 窄屏无水平溢出。
- [ ] **Step 5: `git diff --check`，提交，快进合并到 `develop`，推送 `origin/develop`，删除本任务 worktree 并复核状态。**
