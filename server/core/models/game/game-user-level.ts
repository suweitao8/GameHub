import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'

/**
 * 等级定义：经验值阈值和头衔
 */
export const GAME_LEVEL_DEFINITIONS = [
  { level: 0, minExp: 0, title: '新手玩家' },
  { level: 1, minExp: 100, title: '初级玩家' },
  { level: 2, minExp: 500, title: '中级玩家' },
  { level: 3, minExp: 2000, title: '高级玩家' },
  { level: 4, minExp: 8000, title: '资深玩家' },
  { level: 5, minExp: 30000, title: '精英玩家' },
  { level: 6, minExp: 100000, title: '传奇玩家' }
] as const

export type GameLevelType = typeof GAME_LEVEL_DEFINITIONS[number]['level']

/**
 * 经验值获取规则
 */
export const EXP_REWARDS = {
  DAILY_LOGIN: 5,
  PLAY_GAME: 2,
  COMMENT: 3,
  LIKE: 1,
  FAVORITE: 2,
  COIN: 3,
  PUBLISH_GAME: 20
} as const

/**
 * 根据经验值计算等级
 */
export function calculateLevel (exp: number): { level: GameLevelType; title: string; currentLevelExp: number; nextLevelExp: number | null; progress: number } {
  let currentLevel = 0
  for (const def of GAME_LEVEL_DEFINITIONS) {
    if (exp >= def.minExp) currentLevel = def.level
    else break
  }

  const def = GAME_LEVEL_DEFINITIONS[currentLevel]
  const nextDef = GAME_LEVEL_DEFINITIONS[currentLevel + 1]

  const currentLevelExp = def.minExp
  const nextLevelExp = nextDef ? nextDef.minExp : null
  const progress = nextDef
    ? Math.min(1, (exp - currentLevelExp) / (nextDef.minExp - currentLevelExp))
    : 1

  return {
    level: currentLevel as GameLevelType,
    title: def.title,
    currentLevelExp,
    nextLevelExp,
    progress
  }
}

@Table({
  tableName: 'gameUserLevel',
  indexes: [
    { fields: [ 'accountId' ], unique: true }
  ]
})
export class GameUserLevelModel extends SequelizeModel<GameUserLevelModel> {
  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare exp: number

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare dailyLoginClaimed: boolean

  @AllowNull(true)
  @Column(DataType.DATE)
  declare dailyLoginClaimedAt: Date | null

  @BelongsTo(() => AccountModel, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  /**
   * 获取用户等级信息
   */
  getLevelInfo () {
    return calculateLevel(this.exp)
  }

  /**
   * 增加经验值
   */
  async addExp (amount: number): Promise<boolean> {
    this.exp += amount
    await this.save()
    return true
  }

  /**
   * 确保用户有等级记录（不存在则创建）
   */
  static async ensureForAccount (accountId: number): Promise<GameUserLevelModel> {
    const [ record ] = await GameUserLevelModel.findOrCreate({
      where: { accountId },
      defaults: { accountId, exp: 0 }
    })
    return record
  }
}
