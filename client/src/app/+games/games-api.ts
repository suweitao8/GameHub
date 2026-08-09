export type GamesListParams = {
  view?: 'following' | 'categories'
  search?: string
  category?: string
  publishedAfter?: string
  count?: number
  start?: number
  sort?: 'recommended' | 'latest' | 'updated' | 'popular' | 'likes' | 'coins' | 'favorites'
}

export type GameUploadMetadata = {
  title?: string
  description?: string
  instructions?: string
  category?: string
  tags?: string
  cover?: File | null
}

export function buildGameUploadFormData (file: File, metadata: GameUploadMetadata = {}) {
  const body = new FormData()
  body.append('gamefile', file, file.name)
  if (metadata.cover) body.append('coverfile', metadata.cover, metadata.cover.name)
  if (metadata.title !== undefined) body.append('title', metadata.title)
  if (metadata.description !== undefined) body.append('description', metadata.description)
  if (metadata.instructions !== undefined) body.append('instructions', metadata.instructions)
  if (metadata.category !== undefined) body.append('category', metadata.category)
  if (metadata.tags !== undefined) body.append('tags', metadata.tags)
  return body
}

export function buildGamesListUrl (apiOrigin: string, params: GamesListParams = {}) {
  const query = new URLSearchParams()
  if (params.view) query.set('view', params.view)
  if (params.search) query.set('search', params.search)
  if (params.publishedAfter) query.set('publishedAfter', params.publishedAfter)
  if (params.category) query.set('category', params.category)
  if (params.count !== undefined) query.set('count', params.count + '')
  if (params.start !== undefined) query.set('start', params.start + '')
  if (params.sort) query.set('sort', params.sort)

  const baseUrl = `${apiOrigin.replace(/\/$/, '')}/api/v1/games`
  return query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl
}

export function buildGameRuntimeUrl (runtimeOrigin: string, uuid: string) {
  return new URL(`/api/v1/games/${encodeURIComponent(uuid)}/runtime/`, `${runtimeOrigin.replace(/\/$/, '')}/`).toString()
}

export function isSupportedGameRuntimeFilename (filename: string) {
  return /\.html?$/i.test(filename.trim())
}
