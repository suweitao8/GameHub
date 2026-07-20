import { AllowNull, AutoIncrement, Column, CreatedAt, DataType, Default, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'

export type GameCategoryPreference = 'like' | 'dislike' | 'neutral'

@Table({
  tableName: 'gameUserPreference',
  indexes: [
    { fields: [ 'accountId' ], unique: true }
  ]
})
export class GameUserPreferenceModel extends SequelizeModel<GameUserPreferenceModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  // 用户偏好标签（高权重推荐）
  @Default([])
  @AllowNull(false)
  @Column(DataType.ARRAY(DataType.TEXT))
  declare preferredTags: string[]

  // 用户屏蔽标签（不推荐）
  @Default([])
  @AllowNull(false)
  @Column(DataType.ARRAY(DataType.TEXT))
  declare blockedTags: string[]

  // 用户偏好分类
  @Default([])
  @AllowNull(false)
  @Column(DataType.ARRAY(DataType.TEXT))
  declare preferredCategories: string[]

  // 用户屏蔽分类
  @Default([])
  @AllowNull(false)
  @Column(DataType.ARRAY(DataType.TEXT))
  declare blockedCategories: string[]

  // 推荐算法强度（0-10）
  @Default(5)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare recommendationIntensity: number

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  static async getOrCreateForAccount (accountId: number): Promise<GameUserPreferenceModel> {
    const [ record ] = await GameUserPreferenceModel.findOrCreate({
      where: { accountId },
      defaults: { accountId }
    })
    return record
  }
}
