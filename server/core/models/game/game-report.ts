import { AllowNull, AutoIncrement, BelongsTo, Column, CreatedAt, DataType, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameCommentModel } from './game-comment.js'
import { GameModel } from './game.js'

@Table({
  tableName: 'gameReport',
  indexes: [
    { fields: [ 'gameId', 'state' ] },
    { fields: [ 'commentId', 'state' ] },
    { fields: [ 'reporterAccountId' ] }
  ]
})
export class GameReportModel extends SequelizeModel<GameReportModel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare reporterAccountId: number

  @AllowNull(true)
  @ForeignKey(() => GameModel)
  @Column
  declare gameId: number | null

  @AllowNull(true)
  @ForeignKey(() => GameCommentModel)
  @Column
  declare commentId: number | null

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare reason: string

  @AllowNull(false)
  @Column(DataType.STRING(32))
  declare state: 'pending' | 'accepted' | 'rejected'

  @AllowNull(true)
  @Column(DataType.ARRAY(DataType.TEXT))
  declare predefinedReasons: string[] | null

  @BelongsTo(() => AccountModel, { foreignKey: 'reporterAccountId', onDelete: 'CASCADE' })
  declare Reporter: Awaited<AccountModel>

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel> | null

  @BelongsTo(() => GameCommentModel, { foreignKey: 'commentId', onDelete: 'CASCADE' })
  declare Comment: Awaited<GameCommentModel> | null

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
