import type { Game } from '@peertube/peertube-models'
import { Meta, Title } from '@angular/platform-browser'

// 更新游戏详情页的 SEO meta 标签（Open Graph + Twitter Card）
export function updateGameMetaTags (game: Game, meta: Meta, titleService: Title) {
  const title = `${game.title} - GameHub`
  titleService.setTitle('GameHub')

  const baseUrl = window.location.origin
  const gameUrl = `${baseUrl}/games/${game.uuid}`
  const description = game.description?.slice(0, 200) || '试玩这个有趣的网页小游戏'

  setGameMeta(meta, 'description', description)
  setGameMeta(meta, 'og:title', title)
  setGameMeta(meta, 'og:description', description)
  setGameMeta(meta, 'og:url', gameUrl)
  setGameMeta(meta, 'og:type', 'article')
  setGameMeta(meta, 'og:site_name', 'GameHub')
  setGameMeta(meta, 'twitter:card', 'summary_large_image')
  setGameMeta(meta, 'twitter:title', title)
  setGameMeta(meta, 'twitter:description', description)
  setGameMeta(meta, 'twitter:url', gameUrl)

  if (game.coverPath) {
    setGameMeta(meta, 'og:image', game.coverPath)
    setGameMeta(meta, 'twitter:image', game.coverPath)
  }
}

function setGameMeta (meta: Meta, name: string, content: string) {
  const isProperty = name.startsWith('og:')
  const key = isProperty ? 'property' : 'name'
  const existing = meta.getTag(`${key}="${name}"`)
  if (existing) {
    meta.updateTag({ [key]: name, content })
  } else {
    meta.addTag({ [key]: name, content })
  }
}
