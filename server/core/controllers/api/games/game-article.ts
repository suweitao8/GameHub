import { HttpStatusCode } from '@peertube/peertube-models'
import { sha256 } from '@peertube/peertube-node-utils'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { isGameModerator } from '@server/lib/games/game-policy.js'
import { Redis } from '@server/lib/redis.js'
import { AccountModel } from '@server/models/account/account.js'
import { GameArticleModel } from '@server/models/game/game-article.js'
import { asyncMiddleware, authenticate, optionalAuthenticate } from '@server/middlewares/index.js'
import express from 'express'
import { type WhereOptions } from 'sequelize'
import { getUser } from './game-shared.js'

const MAX_TITLE_LENGTH = 160
const MAX_SUMMARY_LENGTH = 360
const MAX_CONTENT_LENGTH = 30000
const MAX_CATEGORY_LENGTH = 64
const MAX_COVER_PATH_LENGTH = 2048
const ARTICLE_VIEW_WINDOW_MS = 30 * 60 * 1000

const articleRouter = express.Router()

articleRouter.get('/articles', optionalAuthenticate, asyncMiddleware(listArticles))
articleRouter.get('/articles/mine', authenticate, asyncMiddleware(listMyArticles))
articleRouter.get('/articles/:slug', optionalAuthenticate, asyncMiddleware(getArticle))
articleRouter.post('/articles', authenticate, asyncMiddleware(createArticle))
articleRouter.put('/articles/:slug', authenticate, asyncMiddleware(updateArticle))
articleRouter.delete('/articles/:slug', authenticate, asyncMiddleware(deleteArticle))
articleRouter.post('/articles/:slug/view', optionalAuthenticate, asyncMiddleware(recordArticleView))

export { articleRouter }

type ArticlePayload = {
  title: string
  summary: string
  content: string
  slug: string
  coverPath: string | null
  category: string
}

function formatArticle (
  article: GameArticleModel,
  includeContent = false,
  creator: Pick<AccountModel, 'id' | 'name' | 'getDisplayName'> | null | undefined = article.Creator
) {
  const formatted = {
    id: article.id,
    title: article.title,
    summary: article.summary,
    slug: article.slug,
    coverPath: article.coverPath,
    category: article.category,
    status: article.status,
    viewCount: article.viewCount,
    createdBy: creator ? {
      id: creator.id,
      name: creator.name,
      displayName: creator.getDisplayName()
    } : null,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt
  }

  return includeContent ? { ...formatted, content: article.content } : formatted
}

function normalizeRequiredText (value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string') return { error: `${label}不能为空` }

  const text = value.trim()
  if (!text) return { error: `${label}不能为空` }
  if (text.length > maxLength) return { error: `${label}不能超过 ${maxLength} 个字符` }

  return { value: text }
}

function normalizeOptionalText (value: unknown, label: string, maxLength: number) {
  if (value === undefined) return { value: undefined }
  if (value === null || value === '') return { value: null }
  if (typeof value !== 'string') return { error: `${label}格式不正确` }

  const text = value.trim()
  if (text.length > maxLength) return { error: `${label}不能超过 ${maxLength} 个字符` }

  return { value: text || null }
}

function normalizeSlug (value: unknown, fallback: string) {
  const source = typeof value === 'string' && value.trim() ? value : fallback
    const slug = source
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_TITLE_LENGTH)

  return slug || `article-${Date.now()}`
}

function normalizeCoverPath (value: unknown) {
  if (value === undefined) return { value: undefined }
  if (value === null || value === '') return { value: null }
  if (typeof value !== 'string') return { error: '封面地址格式不正确' }

  const coverPath = value.trim()
  if (coverPath.length > MAX_COVER_PATH_LENGTH) return { error: `封面地址不能超过 ${MAX_COVER_PATH_LENGTH} 个字符` }
  if (!coverPath.startsWith('/') && !/^https?:\/\//i.test(coverPath)) return { error: '封面地址必须是站内路径或 http(s) 地址' }

  return { value: coverPath }
}

function buildSummary (content: string) {
  return content.replace(/\s+/g, ' ').slice(0, 180)
}

function parseCreatePayload (body: unknown): { value: ArticlePayload } | { error: string } {
  if (!body || typeof body !== 'object') return { error: '请求内容格式不正确' }
  const data = body as Record<string, unknown>
  const title = normalizeRequiredText(data.title, '标题', MAX_TITLE_LENGTH)
  const content = normalizeRequiredText(data.content, '正文', MAX_CONTENT_LENGTH)
  const summary = normalizeOptionalText(data.summary, '摘要', MAX_SUMMARY_LENGTH)
  const category = normalizeOptionalText(data.category, '分类', MAX_CATEGORY_LENGTH)
  const coverPath = normalizeCoverPath(data.coverPath)

  if ('error' in title) return { error: title.error }
  if ('error' in content) return { error: content.error }
  if ('error' in summary) return { error: summary.error }
  if ('error' in category) return { error: category.error }
  if ('error' in coverPath) return { error: coverPath.error }

  return {
    value: {
      title: title.value,
      content: content.value,
      summary: summary.value || buildSummary(content.value),
      slug: normalizeSlug(data.slug, title.value),
      coverPath: coverPath.value || null,
      category: category.value || '心得'
    }
  }
}

async function listArticles (req: express.Request, res: express.Response) {
  return traceGameOperation('listGameArticles', async () => {
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))
    const start = Math.max(0, Number(req.query.start) || 0)
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : ''
    const where: WhereOptions = {
      status: 'published',
      ...(category ? { category } : {})
    }
    const { count: total, rows } = await GameArticleModel.findAndCountAll({
      where,
      include: [ { model: AccountModel, as: 'Creator', required: true } ],
      order: [ [ 'publishedAt', 'DESC' ], [ 'createdAt', 'DESC' ] ],
      limit: count,
      offset: start
    })

    return res.json({ total, data: rows.map(article => formatArticle(article)) })
  })
}

async function listMyArticles (req: express.Request, res: express.Response) {
  return traceGameOperation('listMyGameArticles', async () => {
    const user = getUser(res)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 50))
    const start = Math.max(0, Number(req.query.start) || 0)
    const { count: total, rows } = await GameArticleModel.findAndCountAll({
      where: { createdByAccountId: user.Account.id },
      include: [ { model: AccountModel, as: 'Creator', required: true } ],
      order: [ [ 'updatedAt', 'DESC' ] ],
      limit: count,
      offset: start
    })

    return res.json({ total, data: rows.map(article => formatArticle(article)) })
  })
}

async function getArticle (req: express.Request, res: express.Response) {
  return traceGameOperation('getGameArticle', async () => {
    const article = await GameArticleModel.findOne({
      where: { slug: req.params.slug, status: 'published' },
      include: [ { model: AccountModel, as: 'Creator', required: true } ]
    })
    if (!article) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    return res.json(formatArticle(article, true))
  })
}

async function createArticle (req: express.Request, res: express.Response) {
  return traceGameOperation('createGameArticle', async () => {
    const parsed = parseCreatePayload(req.body)
    if ('error' in parsed) return res.status(HttpStatusCode.BAD_REQUEST_400).json(parsed)

    const user = getUser(res)
    let article: GameArticleModel
    try {
      article = await GameArticleModel.create({
        ...parsed.value,
        status: 'published',
        viewCount: 0,
        createdByAccountId: user.Account.id,
        publishedAt: new Date()
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
        return res.status(HttpStatusCode.CONFLICT_409).json({ error: '链接标识已被使用，请换一个' })
      }
      throw error
    }
    const creator = await AccountModel.findByPk(article.createdByAccountId)

    return res.status(HttpStatusCode.CREATED_201).json(formatArticle(article, true, creator))
  })
}

async function updateArticle (req: express.Request, res: express.Response) {
  return traceGameOperation('updateGameArticle', async () => {
    if (!req.body || typeof req.body !== 'object') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '请求内容格式不正确' })

    const article = await GameArticleModel.findOne({
      where: { slug: req.params.slug },
      include: [ { model: AccountModel, as: 'Creator', required: true } ]
    })
    if (!article) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    if (!isGameModerator(user) && article.createdByAccountId !== user.Account.id) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    const data = req.body as Record<string, unknown>
    if (data.title !== undefined) {
      const title = normalizeRequiredText(data.title, '标题', MAX_TITLE_LENGTH)
      if ('error' in title) return res.status(HttpStatusCode.BAD_REQUEST_400).json(title)
      article.title = title.value
    }
    if (data.content !== undefined) {
      const content = normalizeRequiredText(data.content, '正文', MAX_CONTENT_LENGTH)
      if ('error' in content) return res.status(HttpStatusCode.BAD_REQUEST_400).json(content)
      article.content = content.value
    }
    if (data.summary !== undefined) {
      const summary = normalizeOptionalText(data.summary, '摘要', MAX_SUMMARY_LENGTH)
      if ('error' in summary) return res.status(HttpStatusCode.BAD_REQUEST_400).json(summary)
      article.summary = summary.value || buildSummary(article.content)
    } else if (data.content !== undefined) {
      article.summary = buildSummary(article.content)
    }
    if (data.category !== undefined) {
      const category = normalizeOptionalText(data.category, '分类', MAX_CATEGORY_LENGTH)
      if ('error' in category) return res.status(HttpStatusCode.BAD_REQUEST_400).json(category)
      article.category = category.value || '心得'
    }
    if (data.coverPath !== undefined) {
      const coverPath = normalizeCoverPath(data.coverPath)
      if ('error' in coverPath) return res.status(HttpStatusCode.BAD_REQUEST_400).json(coverPath)
      article.coverPath = coverPath.value || null
    }
    if (data.slug !== undefined) {
      const slug = normalizeSlug(data.slug, article.title)
      if (slug !== article.slug) {
        article.slug = slug
      }
    }

    try {
      await article.save()
    } catch (error) {
      if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
        return res.status(HttpStatusCode.CONFLICT_409).json({ error: '链接标识已被使用，请换一个' })
      }
      throw error
    }
    return res.json(formatArticle(article, true))
  })
}

async function deleteArticle (req: express.Request, res: express.Response) {
  return traceGameOperation('deleteGameArticle', async () => {
    const article = await GameArticleModel.findOne({ where: { slug: req.params.slug } })
    if (!article) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    if (!isGameModerator(user) && article.createdByAccountId !== user.Account.id) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    await article.destroy()
    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

async function recordArticleView (req: express.Request, res: express.Response) {
  return traceGameOperation('recordGameArticleView', async () => {
    const article = await GameArticleModel.findOne({
      where: { slug: req.params.slug, status: 'published' },
      attributes: [ 'id', 'viewCount' ]
    })
    if (!article) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const viewer = user
      ? `account:${user.Account.id}`
      : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`
    const viewKey = `${Redis.Instance.getPrefix()}game-article-view:${article.id}:${sha256(viewer)}`
    let shouldCount = true

    try {
      const marker = await Redis.Instance.getClient().set(viewKey, '1', 'PX', ARTICLE_VIEW_WINDOW_MS, 'NX')
      shouldCount = marker === 'OK'
    } catch {
      // 阅读量不应因 Redis 暂时不可用而让文章页面失败，降级为直接计数。
      shouldCount = true
    }

    if (shouldCount) {
      await GameArticleModel.increment('viewCount', { where: { id: article.id } })
    }
    const updated = await GameArticleModel.findByPk(article.id, { attributes: [ 'viewCount' ] })
    return res.json({ viewCount: updated?.viewCount ?? (shouldCount ? article.viewCount + 1 : article.viewCount) })
  })
}
