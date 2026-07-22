export type GameSortMetric = 'recommended' | 'latest' | 'updated' | 'plays' | 'likes' | 'coins' | 'favorites'

export function getGameSortMetric (sort?: string): GameSortMetric {
  if (sort === 'latest') return 'latest'
  if (sort === 'updated') return 'updated'
  if (sort === 'popular') return 'plays'
  if (sort === 'likes') return 'likes'
  if (sort === 'coins') return 'coins'
  if (sort === 'favorites') return 'favorites'
  return 'recommended'
}
