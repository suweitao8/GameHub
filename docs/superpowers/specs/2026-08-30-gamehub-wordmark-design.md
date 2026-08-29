# GameHub 字标与 G 图标重设计

## 目标

把 GameHub 的品牌识别收敛成两个明确的使用位：

1. 网站页头左上角使用横向 `GameHub` 字标，参考 B 站字标的简洁、紧凑和易识别，而不是复制其蓝色或字形。
2. 浏览器标签页使用独立的 `G` 图标。图标与页头字标采用同一套品牌色、笔画语言和圆角几何。

## 设计判断

现有 GameHub 设计令牌已经把电光靛蓝定义为主品牌色：`#5044e4`。紫色/靛蓝也实际出现在游戏中心的按钮、导航和卡片交互中；蓝色只是信息语义色，不适合作为品牌主色。

因此本次不再使用彩虹渐变，也不使用 B 站蓝：

- 字标：单色电光靛蓝 `#5044e4`，圆润、厚重、紧凑的 `GameHub` 横向字标。
- 图标：同样的圆角几何 `G`，使用 `#5044e4` 填充，透明背景，保证在浅色浏览器标签栏中清晰可辨。
- 交互：保持轻微的上移反馈和可见焦点，不使用旋转、彩虹变色等与字标不一致的装饰。

## 资源与使用位

| 使用位 | 资源 | 规则 |
| --- | --- | --- |
| 游戏中心页头 | `gamehub-wordmark.svg` | 显示完整 `GameHub`，图片 `alt="GameHub"` |
| 移动端菜单顶部 | `gamehub-wordmark.svg` | 与页头使用同一字标，缩小但不隐藏文字 |
| favicon / 浏览器标签页 | `gamehub-favicon.svg` | 独立 `G` 图标，透明背景 |
| 通用方形 Logo fallback | `gamehub-logo.svg` / `logo.svg` | 与 favicon 使用同一 `G` 图标，兼容旧的嵌入页面和服务端方形 Logo |
| 服务端桌面 header-wide | `gamehub-wordmark.svg` | 复用同一横向字标；自定义实例 Logo 仍优先于默认 fallback |

## 非目标

- 不改变 GameHub 页面已有的整体靛蓝、覆盆子红和轻画布设计令牌。
- 不新增第三方字体或运行时依赖。
- 不把页头字标和 favicon 强行做成同一个文件；它们是不同尺寸和语义下的两个品牌资产。

## 可访问性与响应式

- 页头字标是品牌链接内容，提供 `alt="GameHub"`。
- G 图标在装饰性使用位提供空 `alt` 和 `aria-hidden="true"`；favicon 通过 SVG title/desc 自描述。
- 窄屏仍保留完整字标，只缩小宽度；只有独立 favicon 使用 G 图标。
- 交互动画遵守 `prefers-reduced-motion: reduce`，焦点状态不能依赖颜色变化才能识别。

## 验收标准

- 源码中页头和移动端菜单都引用 `gamehub-wordmark.svg`。
- favicon 引用 `gamehub-favicon.svg`；三份方形兼容资源使用相同 G 路径和 `#5044e4`。
- 不再出现 `gamehub-rainbow` 或彩虹色 stop。
- 构建、GameHub 静态契约检查通过。
- 内置浏览器桌面与 390px 窄屏下，字标 SVG 均成功加载、有合理尺寸；窄屏菜单打开后仍可见完整 `GameHub`。
