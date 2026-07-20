import { GameUserLevelModel, EXP_REWARDS } from '@server/models/game/game-user-level.js'

/**
 * 给用户发放经验值
 * 异步执行，不阻塞主流程
 */
export async function awardExp (accountId: number, reward: keyof typeof EXP_REWARDS): Promise<void> {
  const amount = EXP_REWARDS[reward]
  if (!amount || amount <= 0) return

  const record = await GameUserLevelModel.ensureForAccount(accountId)
  await record.addExp(amount)
}

/**
 * 每日登录签到
 * 每天只能签到一次，重置在 UTC 0 点
 */
export async function claimDailyLogin (accountId: number): Promise<{ claimed: boolean; exp: number; totalExp: number; levelInfo: ReturnType<GameUserLevelModel['getLevelInfo']> }> {
  const record = await GameUserLevelModel.ensureForAccount(accountId)

  const today = new Date().toISOString().slice(0, 10)
  const lastClaimDate = record.dailyLoginClaimedAt?.toISOString().slice(0, 10)

  if (lastClaimDate === today) {
    return {
      claimed: false,
      exp: 0,
      totalExp: record.exp,
      levelInfo: record.getLevelInfo()
    }
  }

  record.exp += EXP_REWARDS.DAILY_LOGIN
  record.dailyLoginClaimed = true
  record.dailyLoginClaimedAt = new Date()
  await record.save()

  return {
    claimed: true,
    exp: EXP_REWARDS.DAILY_LOGIN,
    totalExp: record.exp,
    levelInfo: record.getLevelInfo()
  }
}

/**
 * 获取用户等级信息
 */
export async function getUserLevelInfo (accountId: number): Promise<{
  exp: number
  levelInfo: ReturnType<GameUserLevelModel['getLevelInfo']>
  dailyLoginAvailable: boolean
}> {
  const record = await GameUserLevelModel.ensureForAccount(accountId)

  const today = new Date().toISOString().slice(0, 10)
  const lastClaimDate = record.dailyLoginClaimedAt?.toISOString().slice(0, 10)
  const dailyLoginAvailable = lastClaimDate !== today

  return {
    exp: record.exp,
    levelInfo: record.getLevelInfo(),
    dailyLoginAvailable
  }
}
