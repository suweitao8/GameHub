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
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

@Table({
  tableName: 'gameCollection',
  indexes: [
    { fields: [ 'slug' ], unique: true },
    { fields: [ 'status', 'sortOrder' ] }
  ]
})
export class GameCollectionModel extends SequelizeModel<GameCollectionModel> {
  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare title: string

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string | null

  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare slug: string

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare coverPath: string | null

  @AllowNull(false)
  @Default('published')
  @Column(DataType.STRING(32))
  declare status: 'draft' | 'published' | 'archived'

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number

  @AllowNull(true)
  @Column(DataType.DATE)
  declare publishedAt: Date | null

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}

@Table({
  tableName: 'gameCollectionItem',
  indexes: [
    { fields: [ 'collectionId', 'sortOrder' ] },
    { fields: [ 'gameId' ] }
  ]
})
export class GameCollectionItemModel extends SequelizeModel<GameCollectionItemModel> {
  @AllowNull(false)
  @ForeignKey(() => GameCollectionModel)
  @Column
  declare collectionId: number

  @BelongsTo(() => GameCollectionModel, { foreignKey: { allowNull: false } })
  declare Collection: Awaited<GameCollectionModel>

  @AllowNull(false)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number

  @BelongsTo(() => GameModel, { foreignKey: { allowNull: false } })
  declare Game: Awaited<GameModel>

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string | null

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
