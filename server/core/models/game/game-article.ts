import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'

export type GameArticleStatus = 'draft' | 'published'

@Table({
  tableName: 'gameArticle',
  indexes: [
    { fields: [ 'slug' ], unique: true },
    { fields: [ 'status', 'publishedAt' ] },
    { fields: [ 'createdByAccountId', 'createdAt' ] }
  ]
})
export class GameArticleModel extends SequelizeModel<GameArticleModel> {
  @AllowNull(false)
  @Column(DataType.STRING(160))
  declare title: string

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare summary: string

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string

  @AllowNull(false)
  @Column(DataType.STRING(160))
  declare slug: string

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare coverPath: string | null

  @AllowNull(false)
  @Default('心得')
  @Column(DataType.STRING(64))
  declare category: string

  @AllowNull(false)
  @Default('published')
  @Column(DataType.STRING(32))
  declare status: GameArticleStatus

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare viewCount: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare createdByAccountId: number

  @AllowNull(true)
  @Column(DataType.DATE)
  declare publishedAt: Date | null

  @BelongsTo(() => AccountModel, { foreignKey: { allowNull: false, name: 'createdByAccountId' } })
  declare Creator: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
