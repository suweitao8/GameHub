# GameHub 模块需求整理与修改建议

> 生成日期：2026-07-22
> 当前分支：develop
> 最近提交：3cd943f15

---

## 一、已完成功能清单（12 项）

| # | 功能 | 涉及文件 | 状态 |
|---|------|---------|------|
| 1 | 创作者中心趋势图 | `game-creator.component.ts/html/scss` | ✅ 已提交 |
| 2 | 评论骨架屏 | `game-play.component.ts/html/scss` | ✅ 已提交 |
| 3 | 搜索导航 Enter 跳转优化 | `game-navigation.component.ts` | ✅ 已提交 |
| 4 | 排行榜 shimmer 骨架屏 | `game-rankings.component.ts/html/scss` | ✅ 已提交 |
| 5 | 活动列表骨架屏 | `game-events.component.ts/html` | ✅ 已提交 |
| 6 | 排行榜错误重试态 | `game-rankings.component.ts/html/scss` | ✅ 已提交 |
| 7 | 我的游戏库错误重试 + 加载状态修复 | `game-library.component.ts/html` | ✅ 已提交 |
| 8 | 编辑页离开提示逻辑修复 | `game-edit.component.ts` | ✅ 已提交 |
| 9 | 上传页离开提示防误操作 | `game-upload.component.ts` | ✅ 已提交 |
| 10 | 评价区骨架屏增强 | `game-play.component.html/scss` | ✅ 已提交 |
| 11 | 游戏卡片分类标签显示 | `game-card.component.html/scss` | ✅ 已提交 |
| 12 | 搜索页空状态增强（区分搜索/分类/无内容） | `games-home.component.html` | ✅ 已提交 |

---

## 二、待修复问题（3 项，按优先级排序）

### 🔴 P0 - Angular 17 兼容性

**1. `game-following.component.ts` 骨架屏使用旧版 `*ngFor`**
- **位置**：第 32 行
- **问题代码**：`<div class="following-item shimmer" *ngFor="let _ of [1,2,3,4,5]"></div>`
- **修复方案**：替换为 `@for (i of [1,2,3,4,5]; track $index)`
- **影响**：骨架屏在 Angular 17 下可能不渲染

**2. `game-skeleton.component.ts` 检查 shimmer 动画定义**
- 确认是否已定义 `@keyframes skeleton-shimmer`
- 与 `game-play.component.scss` 中定义的 `skeleton-shimmer` 保持一致

---

### 🟡 P1 - 用户体验优化

**3. `game-author.component.html` 错误重试状态缺失**
- **问题**：作者页加载失败（`error() || !author()`）时仅显示静态文本
- **当前**：`<div class="game-community-content author-state"><h1>作者空间暂时不可用</h1></div>`
- **建议**：增加重试按钮和更友好的错误提示
- **参考实现**：可参照 `game-rankings.component.ts` 的 error retry 模式

---

## 三、可选优化建议（低优先级）

### 🟢 P2 - 功能增强

| 编号 | 建议 | 理由 | 预估工作量 |
|------|------|------|-----------|
| 4 | 创作者中心趋势图点击可跳转分析详情页 | 提升数据可探索性 | 中 |
| 5 | 游戏卡片 hover 时显示分类标签 tooltip | 信息展示更完整 | 小 |
| 6 | 排行榜加载更多分页（当前仅展示前 N 条） | 支持浏览更多排行 | 中 |
| 7 | 活动列表增加"即将开始"筛选 | 提升活动发现效率 | 小 |
| 8 | 游戏详情页相关推荐区增加"不感兴趣"反馈 | 个性化推荐优化 | 中 |
| 9 | 搜索结果支持按时间范围筛选 | 搜索体验提升 | 中 |
| 10 | 作者页增加"私信"功能入口 | 社区互动增强 | 大 |

---

## 四、质量检查清单

### 已验证 ✅
- [x] `build:server` 编译通过（每次提交前均执行）
- [x] 骨架屏 shimmer 动画样式统一
- [x] 错误重试态覆盖主要加载场景
- [x] 空状态区分不同场景（搜索/分类/无内容）
- [x] 离开提示逻辑准确（对比原始值）

### 待验证 ⚠️
- [ ] `game-following` 骨架屏在 Angular 17 下的兼容性
- [ ] `game-author` 错误状态的 retry 功能
- [ ] 移动端各页面空状态的显示效果
- [ ] 骨架屏 shimmer 动画在所有组件中的表现一致性

---

## 五、推荐下一步行动

### 立即执行（本轮）
1. 修复 `game-following.component.ts` 的 `*ngFor` → `@for`
2. 为 `game-author.component` 添加错误重试按钮

### 后续迭代（下轮）
3. 创作者中心趋势图点击跳转
4. 排行榜分页加载更多
5. 移动端各页面空状态检查与修复

---

## 六、文件引用速查

| 功能 | 文件路径 |
|------|---------|
| 编辑页离开提示 | `client/src/app/+games/game-edit.component.ts` |
| 上传页离开提示 | `client/src/app/+games/game-upload.component.ts` |
| 评价骨架屏 | `client/src/app/+games/game-play.component.html/scss` |
| 卡片分类标签 | `client/src/app/+games/game-card.component.html/scss` |
| 搜索空状态 | `client/src/app/+games/games-home.component.html` |
| 排行榜错误重试 | `client/src/app/+games/game-rankings.component.ts` |
| 关注列表 | `client/src/app/+games/game-following.component.ts` |
| 作者页 | `client/src/app/+games/game-author.component.html` |

---

*文档由自动扫描生成，如有遗漏请补充。*
