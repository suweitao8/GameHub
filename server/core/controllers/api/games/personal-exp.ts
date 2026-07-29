import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { claimDailyLogin, getUserLevelInfo } from '@server/lib/games/game-exp.js'
import { asyncMiddleware, authenticate } from '@server/middlewares/index.js'
import express from 'express'
import { getUser } from './game-shared.js'

const personalExpRouter = express.Router()

personalExpRouter.get('/me/level', authenticate, asyncMiddleware(getUserLevel))
personalExpRouter.post('/me/level/daily-login', authenticate, asyncMiddleware(claimDailyLoginHandler))

export { personalExpRouter }

/**
 * 获取用户等级信息
 */
async function getUserLevel (_req: express.Request, res: express.Response) {
  return traceGameOperation('getUserLevel', async () => {
    const user = getUser(res)
    const info = await getUserLevelInfo(user.Account.id)
    return res.json(info)
  })
}

/**
 * 每日登录签到
 */
async function claimDailyLoginHandler (_req: express.Request, res: express.Response) {
  return traceGameOperation('claimDailyLogin', async () => {
    const user = getUser(res)
    const result = await claimDailyLogin(user.Account.id)
    return res.json(result)
  })
}
