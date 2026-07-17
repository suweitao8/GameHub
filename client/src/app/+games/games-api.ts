export type GamesListParams = {
  search?: string
  category?: string
  count?: number
  start?: number
}

export function buildGamesListUrl (apiOrigin: string, params: GamesListParams = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.category) query.set('category', params.category)
  if (params.count !== undefined) query.set('count', params.count + '')
  if (params.start !== undefined) query.set('start', params.start + '')

  const baseUrl = `${apiOrigin.replace(/\/$/, '')}/api/v1/games`
  return query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl
}

export function buildGameRuntimeUrl (runtimeOrigin: string, uuid: string) {
  return new URL(`/api/v1/games/${encodeURIComponent(uuid)}/runtime`, `${runtimeOrigin.replace(/\/$/, '')}/`).toString()
}
