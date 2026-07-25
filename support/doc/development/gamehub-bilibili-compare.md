# GameHub vs Bilibili 游戏区需求对比报告

> 日期：2026-07-22
> 状态更新：2026-07-25（与 `develop` 实现对账）
> 对比维度：Bilibili 游戏区核心功能

---

## 一、功能对比总览

| 功能模块 | Bilibili 游戏区 | GameHub 当前 | 差距 |
|---------|----------------|-------------|------|
| 游戏详情页 | 视频 + 评论 + 弹幕 + 推荐 | iframe + 评论 + 评价 + 推荐 + 稍后再玩 | 弹幕、播放历史 |
| 用户互动 | 点赞/投币/收藏/分享/关注 | 点赞/投币/收藏/分享/关注 | ✅ 对齐 |
| 评论区 | 楼层/回复/表情/点赞/置顶 | 评论/回复/点赞 | 表情、置顶 |
| 创作者 | 数据中心/收益/等级/任务 | 趋势图/统计数据/等级 | 收益、任务 |
| 排行榜 | 分类排行榜/更新榜 | 7 种排序（含「最近更新」）+ 分类筛选 | ✅ 高优对齐 |
| 搜索 | 智能搜索/筛选/标签 | 搜索/分类/标签 | 智能提示 |
| 社区 | 动态/关注/话题 | 动态/关注 | 话题 |
| 播放 | 播放进度/历史/收藏夹 | iframe + 稍后再玩列表 | 播放进度/多收藏夹 |
| 首页推荐 | 猜你喜欢 | 基于浏览记录的「猜你喜欢」 | ✅ 高优对齐（纯前端） |
| 作者空间 | 置顶作品 | 置顶作品展示 | ✅ 高优对齐 |

---

## 二、高优先级需求（本轮）

### 1. ✅ 游戏详情页「稍后再玩」功能 — **已完成**

**需求描述**：
用户可以将感兴趣的游戏加入「稍后再玩」列表，方便后续快速找到。

**实现要点**：
- `WatchLaterService` + `localStorage`（含 JSON schema 校验）
- 详情页 action 区「稍后再玩」按钮（`game-play`）
- 独立列表页路由 `/games/watch-later`（`GameWatchLaterComponent`）

**涉及文件**：
- `client/src/app/+games/watch-later.service.ts`
- `client/src/app/+games/game-watch-later.component.ts`
- `client/src/app/+games/game-play.component.ts/html`
- `client/src/app/+games/routes.ts`

---

### 2. ✅ 首页「猜你喜欢」推荐 — **已完成**

**需求描述**：
基于用户浏览历史，在首页推荐个性化游戏。

**实现要点**：
- `GameRecommendService` 记录浏览并打分推荐
- 详情页浏览时 `recordView`；首页 section 消费推荐结果

**涉及文件**：
- `client/src/app/+games/game-recommend.service.ts`
- `client/src/app/+games/games-home.component.ts/html`
- `client/src/app/+games/game-play.component.ts`

---

### 3. ✅ 作者空间「置顶作品」 — **已完成**

**需求描述**：
创作者空间优先展示置顶作品。

**实现要点**：
- 作者页 `author-pinned` / `pinned-badge` 展示

**涉及文件**：
- `client/src/app/+games/game-author.component.html`（及相关 ts/scss）

---

### 4. ✅ 游戏详情页「相关标签云」 — **已完成**

**需求描述**：
详情页展示标签，点击跳转搜索。

**实现要点**：
- `game-tags` / `game-tag` 样式与 `/games?search=tag` 跳转

**涉及文件**：
- `client/src/app/+games/game-play.component.html/scss`

---

### 5. ✅ 排行榜「更新时间」维度 — **已完成**

**需求描述**：
排行榜增加「最近更新」维度。

**实现要点**：
- 前端 tab `updated` / 文案「最近更新」
- 后端排序支持 `updated`（`game-query` / games API）

**涉及文件**：
- `client/src/app/+games/game-rankings.component.ts`
- `server/core/lib/games/game-query.ts`（及相关 API）

---

## 三、中优先级需求（后续迭代，本轮不实现）

| # | 需求 | 说明 | 复杂度 | 状态 |
|---|------|------|--------|------|
| 6 | 评论表情支持 | 评论区支持 emoji 表情选择 | 中 | 后续迭代 |
| 7 | 弹幕系统 | 游戏内嵌弹幕（iframe 通信） | 高 | 后续迭代 |
| 8 | 播放历史记录 | 记录用户玩过哪些游戏 | 中 | 后续迭代 |
| 9 | 收藏夹功能 | 用户创建多个收藏夹分类收藏 | 高 | 后续迭代 |
| 10 | 收益中心 | 创作者查看游戏收益数据 | 高 | 后续迭代 |
| 11 | 话题系统 | 基于话题聚合社区内容 | 高 | 后续迭代 |
| 12 | 智能搜索提示 | 搜索框自动补全/热门搜索 | 中 | 后续迭代 |

---

## 四、本轮交付小结

### 高优先级（5/5 已完成）

1. ✅ 「稍后再玩」
2. ✅ 首页「猜你喜欢」
3. ✅ 排行榜「最近更新」
4. ✅ 详情页标签云
5. ✅ 作者空间置顶作品

### 明确不做（中优先级整表）

见第三节；后续迭代再开目标，避免范围膨胀。

### 本地可运行约定（与实现对账）

- 客户端静态：服务端从 `client/dist/browser` 提供 `/client/**`
- HTML：`client/dist/browser/<locale>/index.html`
- 首页 banner：`/client/assets/images/gamehub-header-banner-10x1.png`（绝对路径）
- Windows 轻量构建：`pnpm run build:client:light`（`scripts/build/client-light.ps1`）
- 结构回归：`pnpm run verify:gamehub-client`

---

## 五、参考截图（描述）

### B站「稍后再看」
- 视频详情页右侧 action 区有「稍后再看」按钮
- 用户头像下拉菜单有「稍后再看」入口
- 列表页展示视频封面 + 标题 + UP主

### B站「猜你喜欢」
- 首页信息流中穿插「猜你喜欢」模块
- 基于用户最近浏览记录推荐
- 卡片样式与普通推荐一致

### B站 UP主空间置顶
- 空间首页顶部有大图置顶作品
- 置顶作品有「置顶」标签
- 点击跳转视频详情

---

*报告生成于 2026-07-22；完成状态对账于 2026-07-25*
