export const HOME_CATEGORIES: readonly {
  id: string
  title: string
  description: string
  query: { category: string }
}[] = [
  { id: 'arcade', title: '动作', description: '快速反应，马上开始一局。', query: { category: 'arcade' } },
  { id: 'adventure', title: '冒险', description: '探索地图，发现隐藏的故事。', query: { category: 'adventure' } },
  { id: 'shooter', title: '射击', description: '瞄准目标，挑战你的反应速度。', query: { category: 'shooter' } },
  { id: 'puzzle', title: '解谜', description: '动动脑筋，找出下一步。', query: { category: 'puzzle' } },
  { id: 'casual', title: '休闲', description: '轻松打开，随时玩一会儿。', query: { category: 'casual' } },
  { id: 'rpg', title: '角色扮演', description: '塑造角色，开启一段新旅程。', query: { category: 'rpg' } },
  { id: 'strategy', title: '策略', description: '规划资源，赢下更大的局。', query: { category: 'strategy' } },
  { id: 'simulation', title: '模拟', description: '在虚拟世界里体验另一种生活。', query: { category: 'simulation' } },
  { id: 'sandbox', title: '沙盒', description: '自由创造，按照自己的方式游玩。', query: { category: 'sandbox' } },
  { id: 'sports', title: '体育', description: '在轻量对局中享受竞技乐趣。', query: { category: 'sports' } },
  { id: 'card', title: '卡牌', description: '组合卡组，做出关键的选择。', query: { category: 'card' } },
  { id: 'music', title: '音乐', description: '跟随节奏，完成一场声音之旅。', query: { category: 'music' } },
  { id: 'horror', title: '恐怖', description: '戴上耳机，探索未知角落。', query: { category: 'horror' } },
  { id: 'board', title: '桌游', description: '熟悉的规则，适合短时游玩。', query: { category: 'board' } }
]

/** Average of the three CSS placeholder gradient stops used when a game has no image. */
export const FEATURED_PLACEHOLDER_AVG_RGB = '143, 106, 81'
