export type GameArticleStatus = 'draft' | 'published'

export interface GameArticleAuthor {
  id: number
  name: string
  displayName: string
}

export interface GameArticle {
  id: number
  title: string
  summary: string
  slug: string
  coverPath: string | null
  category: string
  status: GameArticleStatus
  viewCount: number
  createdBy: GameArticleAuthor | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GameArticleDetail extends GameArticle {
  content: string
}

export interface GameArticleList {
  total: number
  data: GameArticle[]
}

export interface GameArticleInput {
  title: string
  summary?: string | null
  content: string
  slug?: string | null
  coverPath?: string | null
  category?: string | null
}

export interface GameArticleViewResult {
  viewCount: number
}
