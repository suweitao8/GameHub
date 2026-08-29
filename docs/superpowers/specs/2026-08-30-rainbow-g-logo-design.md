# GameHub 彩虹 G Logo 设计

## 设计读取

这是面向玩家与创作者的 GameHub 品牌重设计，采用明亮、游戏感、干净但有能量的视觉语言。彩虹色只用于品牌标识本身，页面其余部分继续使用现有 GameHub 靛蓝与浅色设计令牌，避免多色渐变扩散到整个界面。

## 目标

- 将 GameHub 的品牌图标统一为一个几何化的字母 G。
- 使用一条从暖色到冷色的彩虹渐变，保留品牌的活力与游戏属性。
- 让游戏页面 Header、移动端菜单中的品牌标识、浏览器标签页 favicon 与服务器静态 Logo fallback 使用相同的 G 轮廓和渐变。
- 不引入新依赖，不改变登录、导航、游戏运行时或服务器配置接口。

## 方案

### 统一的 SVG 标识

使用透明背景、512 × 512 viewBox 的圆角粗线 G。G 由一条连续的圆弧和向内收的横臂组成，线帽和线连接均为圆角，保证在 Header 的 30–48px 尺寸以及浏览器标签页的小尺寸下仍然可辨认。

渐变沿标识路径横向扫过以下颜色：珊瑚红、橙色、金黄、绿色、青色与靛紫。渐变直接绘制在 G 的 stroke 上，不添加独立的方形底板，因此 favicon 与页面图标可以做到轮廓完全一致。

保留 `gamehub-logo.svg` 作为 GameHub 页面使用的主资源，同时让 `gamehub-favicon.svg` 与既有 `logo.svg` fallback 使用同一份几何标识内容。保留旧文件名是为了避免已有静态路径或外部缓存失效。

### 页面接入

- 游戏体验 Header 不再用 CSS `content: 'G'` 伪元素绘制图标，改为直接渲染 `gamehub-logo.svg`，与 favicon 使用同一资产语义。
- 游戏 Header 的图标为装饰性图片，`alt=""` 与 `aria-hidden="true"`；可访问名称由现有 `GameHub` 字标和链接标题提供。
- 移动端侧栏品牌位置也直接渲染同一 SVG，避免 CSS 背景或字体替代造成形状漂移。
- `client/src/index.html` 的 favicon 指向统一的 SVG；服务器 `ServerConfigManager` 的 favicon、移动 Header 与桌面 Header fallback 也指向同一标识。
- 保留现有 Header hover/focus 状态的轻微缩放反馈，不增加持续动画；`prefers-reduced-motion` 不会受到影响。

## 范围与边界

本次只改 Logo 资产、Logo 入口与静态契约校验。服务器允许管理员上传自定义 instance logo 的行为保持不变；只有没有自定义 Logo 时才使用新的 GameHub fallback。OpenGraph/应用图标等未被当前页面 Logo 需求引用的资产不做无关替换。

## 验证

1. 静态契约校验确认页面 favicon、Header 图片、侧栏图片和服务器 fallback 都指向新的资源，并确认三个兼容 SVG 包含同一 G path 与渐变 stop。
2. 运行客户端相关 lint 与轻量生产构建，确认 SVG 与模板不会破坏 Angular 构建。
3. 启动本地页面后用真实浏览器检查桌面与窄屏 Header：Logo 显示为彩虹 G，favicon 请求返回 SVG，图标在两处视觉一致，链接仍可点击且没有控制台错误。
