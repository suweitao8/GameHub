# 游戏分类预设封面设计说明

## 目标

为没有上传封面的游戏提供与游戏分类匹配的预设背景，并在投稿时将“分类背景 + 游戏标题”合成为轻量的 \`512×288\` JPG 封面。用户手动上传的封面继续按原文件发送，不做隐式重编码。

## 范围与不变项

- 覆盖投稿自动封面、首页游戏卡片、推荐轮播、排行、个人库、预约列表、详情页相关游戏和顶部游戏动态预览。
- 预设素材放在 \`client/src/assets/images/game-cover-presets/\`，通过 Angular 现有静态资源复制规则随客户端发布。
- 旧的同步 SVG 生成器保留为素材加载失败时的最终本地兜底，避免单张静态资源异常导致投稿或卡片破损。
- 不改服务端封面存储协议；服务端已经接受 JPEG，且 \`2MB\` 限制远高于新的自动封面。
- 不改推荐算法；本次只改变封面素材与生成格式。

## 视觉与素材

每个分类使用一张独立的 16:9、无文字、无 Logo、无水印的背景图。视觉统一为克制的浅色内容平台风格，使用低饱和的几何、纸张、网格或抽象材质，给标题留出干净的安全区。分类到素材的映射固定为：

| 分类 | 文件 |
| --- | --- |
| \`arcade\` 动作 | \`arcade.jpg\` |
| \`adventure\` 冒险 | \`adventure.jpg\` |
| \`shooter\` 射击 | \`shooter.jpg\` |
| \`puzzle\` 解谜 | \`puzzle.jpg\` |
| \`casual\` 休闲 | \`casual.jpg\` |
| \`rpg\` 角色扮演 | \`rpg.jpg\` |
| \`strategy\` 策略 | \`strategy.jpg\` |
| \`simulation\` 模拟 | \`simulation.jpg\` |
| \`sandbox\` 沙盒 | \`sandbox.jpg\` |
| \`racing\` 竞速 | \`racing.jpg\` |
| \`sports\` 体育 | \`sports.jpg\` |
| \`card\` 卡牌 | \`card.jpg\` |
| \`music\` 音乐 | \`music.jpg\` |
| \`horror\` 恐怖 | \`horror.jpg\` |
| \`board\` 桌游 | \`board.jpg\` |
| 其他/未知 | \`other.jpg\` |

源图在进入仓库前统一裁切为 \`512×288\` 并转为 JPEG，质量设置为 \`78\`，通过脚本验证 JPEG 文件头、尺寸和单文件体积上限。

## 运行时链路

1. \`getGameCoverPresetUrl(category)\` 对分类做小写和未知值归一化，返回 \`/client/assets/images/game-cover-presets/<category>.jpg\`。
2. 所有无封面展示位优先请求这个 URL；展示位的现有 \`(error)\` 处理在预设资源失败时退回同步 SVG。
3. \`CoverGeneratorService.generateAutomaticCover\` 加载预设，按 \`cover\` 方式填充 16:9 canvas，底部绘制半透明浅色标题板和最多两行标题，然后用 \`canvas.toBlob(..., 'image/jpeg', 0.78)\` 生成 \`gamehub-auto-cover.jpg\`。
4. \`coverFromScreenshot\` 也统一输出 \`512×288\` JPEG；保留运行时截图的标题能力，但使用浅色标题板，不再生成大尺寸 PNG。
5. 投稿组件保持“用户封面优先、自动封面兜底”的现有选择逻辑。自动生成失败仍允许投稿，服务端会保留 \`coverPath = null\`，展示层随后使用分类预设。

## 验收标准

- 每个固定分类都能得到稳定的预设 URL，未知分类落到 \`other.jpg\`。
- 16 张素材都是 \`512×288\` JPEG，且单张不超过 \`120KB\`；不提交源 PNG。
- 自动投稿封面文件名以 \`.jpg\` 结尾，MIME 为 \`image/jpeg\`，尺寸为 \`512×288\`，标题在浅色信息板上可读。
- 手动上传的 File 对象不经过自动生成器和重编码。
- 首页和其他展示位的历史无封面游戏使用分类预设；已有封面仍优先显示。
- 原有游戏封面测试、客户端静态校验、客户端构建和 GameHub 自检门禁通过。
