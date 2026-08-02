import { Op } from 'sequelize'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { AccountModel } from '@server/models/account/account.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'
import { GameModel } from '@server/models/game/game.js'
import type { GameActivityKind } from '@server/models/game/game-activity.js'

const MAX_FEED_ITEMS = 50

/**
 * 获取用户关注动态 Feed
 * 返回关注的人/游戏的最新活动
 */
export async function getFollowingFeed (accountId: number, options: {
  limit?: number
  offset?: number
}): Promise<{ total: number; data: Awaited<ReturnType<typeof formatActivity>>[] }> {
  const limit = Math.min(MAX_FEED_ITEMS, Math.max(1, options.limit || 20))
  const offset = Math.max(0, options.offset || 0)

  // 通过 account 找到 actor，再获取关注列表
  const account = await AccountModel.findByPk(accountId)
  if (!account?.Actor) return { total: 0, data: [] }

  // 获取关注的目标 actor IDs
  const followRows = await ActorFollowModel.findAll({
    where: { actorId: account.Actor.id, state: 'accepted' },
    attributes: [ 'targetActorId' ],
    raw: true
  })
  const targetActorIds = followRows.map(f => f.targetActorId)
  if (targetActorIds.length === 0) return { total: 0, data: [] }

  // 通过 targetActorIds 找到对应的 Account ids
  const { sequelizeTypescript } = await import('@server/initializers/database.js')
  const actorRows = await sequelizeTypescript.query(`
    SELECT "accountId" FROM "actor" WHERE "id" IN (:targetActorIds)
  `, {
    replacements: { targetActorIds },
    type: 'SELECT'
  })

  const targetAccountIds = (actorRows as { accountId: number }[]).map(r => r.accountId)
  if (targetAccountIds.length === 0) return { total: 0, data: [] }

  const [ total, activities ] = await Promise.all([
    GameActivityModel.count({
      where: {
        actorAccountId: { [Op.in]: targetAccountIds },
        kind: { [Op.ne]: 'review' }
      }
    }),
    GameActivityModel.findAll({
      where: {
        actorAccountId: { [Op.in]: targetAccountIds },
        kind: { [Op.ne]: 'review' }
      },
      include: [
        {
          model: AccountModel,
          required: true
        },
        {
          model: GameModel,
          required: false
        }
      ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit,
      offset
    })
  ])

  const data = activities.map(formatActivity)

  return { total, data }
}

/**
 * 获取全局动态 Feed（发现页，所有公开活动）
 */
export async function getPublicFeed (options: {
  limit?: number
  offset?: number
  kinds?: GameActivityKind[]
}): Promise<{ total: number; data: Awaited<ReturnType<typeof formatActivity>>[] }> {
  const limit = Math.min(MAX_FEED_ITEMS, Math.max(1, options.limit || 20))
  const offset = Math.max(0, options.offset || 0)

  const where: any = { kind: { [Op.ne]: 'review' } }
  if (options.kinds && options.kinds.length > 0) {
    where.kind = { [Op.in]: options.kinds, [Op.ne]: 'review' }
  }

  const [ total, activities ] = await Promise.all([
    GameActivityModel.count({ where }),
    GameActivityModel.findAll({
      where,
      include: [
        { model: AccountModel, required: true },
        { model: GameModel, required: false }
      ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit,
      offset
    })
  ])

  const data = activities.map(formatActivity)

  return { total, data }
}

function formatActivity (activity: GameActivityModel) {
  return {
    id: activity.id,
    kind: activity.kind,
    message: activity.message,
    createdAt: activity.createdAt,
    actor: activity.Actor
      ? {
          id: activity.Actor.id,
          name: activity.Actor.name,
          displayName: (activity.Actor as any).getDisplayName?.()
        }
      : null,
    game: activity.Game
      ? {
          uuid: activity.Game.uuid,
          title: activity.Game.title,
          coverPath: activity.Game.coverPath
        }
      : null
  }
}
