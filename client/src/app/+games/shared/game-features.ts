/**
 * GameHub 功能开关。
 *
 * 暂时屏蔽的功能把对应标志设为 false 即可，入口（链接、导航项、路由重定向）
 * 会统一隐藏；恢复时改回 true。功能代码本身保留，方便随时启用。
 */
export const GAME_FEATURES = {
  /** 创作中心：导航栏快捷入口、下拉菜单项、个人中心入口、关于页引导等 */
  creatorCenter: false
} as const

export type GameFeatureFlags = typeof GAME_FEATURES
