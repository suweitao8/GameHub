import { areGameTagsValid, isGameCategoryValid, isGameDescriptionValid, isGameTitleValid } from '@server/helpers/custom-validators/games.js'
import { areValidationErrors } from '@server/middlewares/validators/shared/index.js'
import { body, param, query } from 'express-validator'
import express from 'express'

export const gameUUIDValidator = [
  param('uuid').isUUID(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    next()
  }
]

export const gameListValidator = [
  query('category').optional().isLength({ min: 1, max: 64 }),
  query('search').optional().isLength({ min: 1, max: 120 }),
  query('publishedAfter').optional().isISO8601(),
  query('device').optional().isIn([ 'mobile', 'keyboard', 'mouse', 'touch' ]),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    next()
  }
]

export const gameCreateValidator = [
  body('title').custom(isGameTitleValid),
  body('description').optional().custom(isGameDescriptionValid),
  body('instructions').optional().custom(isGameDescriptionValid),
  body('category').custom(isGameCategoryValid),
  body('tags').optional().custom(value => areGameTagsValid(parseGameTags(value))),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    next()
  }
]

export const gameModerationValidator = [
  ...gameUUIDValidator,
  body('action').isIn([ 'approve', 'reject', 'unlist', 'block' ]),
  body('reason').optional().isLength({ max: 2000 }),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    next()
  }
]

export function parseGameTags (value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value !== 'string' || value.trim() === '') return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as string[] : []
  } catch {
    return value.split(',').map(tag => tag.trim()).filter(Boolean)
  }
}
