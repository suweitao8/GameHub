import { AccountModel } from '@server/models/account/account.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { GameModel } from '@server/models/game/game.js'
import type { MGame } from '@server/types/models/game/game.js'
import express from 'express'

export type CommentSortOption = 'hot' | 'new' | 'old'

export async function getPublishedGame (req: express.Request) {
  return GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
}

export function getUser (res: express.Response) {
  return res.locals.oauth?.token.User
}

export async function getGameAuthor (game: MGame) {
  return AccountModel.findByPk(game.ownerAccountId, {
    include: [ { model: ActorModel, required: true } ]
  })
}

export const commentAccountInclude = {
  model: AccountModel,
  required: false,
  include: [ { model: ActorModel, required: false } ]
}
