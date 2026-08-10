# 游戏导航栏视觉与响应式布局实施计划

> **For agentic workers:** 本计划已由当前任务批准，按步骤执行并在每个验证门禁后继续。

**目标：** 移除游戏体验页导航栏背景图、固定桌面端白色 56px 高度，并让游戏发现页的动态/热门/分类导航按屏幕宽度自适应铺满。

**架构：** 调整现有游戏体验页的 CSS 变量和导航栏样式，并将游戏发现页的入口合并到一个 CSS Grid 横向容器。导航内容、路由、定位、边框、阴影和移动端 58px 高度保持不变。

**技术栈：** Angular、SCSS、pnpm、浏览器自动化。

---

### 任务 1：先建立样式回归断言

**文件：**

- 修改：`client/src/app/app.component.scss:38-70`
- 修改：`client/src/app/header/header.component.scss:45-86`
- 修改：`scripts/verify-gamehub-client.mjs:937-945`
- 验证：运行客户端 lint/build 与浏览器计算样式断言

- [ ] 在实现前记录当前浏览器断言：桌面端高度 200px、背景图存在。
- [ ] 实现 `--header-height: 56px`、白色背景和 `background-image: none`。
- [ ] 删除桌面端 200px/50px 高度切换，只保留移动端 58px。
- [ ] 同步 GameHub header 静态契约，避免旧的 200px 横幅要求覆盖已批准设计。
- [ ] 运行 `cd client && npm run lint`。
- [ ] 运行 `pnpm run build:client`。
- [ ] 在 `/games/author/2` 断言背景色、背景图、尺寸以及滚动前后高度。
- [ ] 提交变更并合并到 `develop`。

### 任务 2：让发现页导航按可用宽度动态铺满

**文件：**

- 修改：`client/src/app/+games/games-home.component.html:40-75`
- 修改：`client/src/app/+games/games-home/_discovery-nav.scss:1-150`
- 修改：`client/src/app/+games/games-home/_responsive.scss:17-31`
- 修改：`scripts/verify-gamehub-client.mjs:321-332`
- 验证：静态契约、SCSS lint、客户端构建和真实浏览器尺寸/点击检查

- [ ] 先运行静态契约，确认旧的固定宽度布局不满足动态导航断言。
- [ ] 将动态、热门和分类入口放入同一个 `.home-discovery-links` 容器。
- [ ] 使用 `grid-auto-columns: minmax(clamp(3.8rem, 5vw, 4.2rem), 1fr)` 和横向滚动兜底，让宽屏入口等宽铺满、窄屏保持可读和可点击。
- [ ] 更新静态契约，要求两处模板都使用统一容器，并禁止旧的固定宽度容器和 `width: 4.8rem`。
- [ ] 在 1440px、768px、375px 浏览器视口检查入口宽度、容器滚动宽度和页面横向溢出。
- [ ] 点击动态与热门入口，确认目标 URL 分别为 `/games/activity` 和 `/games?sort=popular`。
