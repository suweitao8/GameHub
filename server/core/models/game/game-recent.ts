import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel } from '../shared/index.js'
import { GameModel } from './game.js'

@Table({
  tableName: 'gameRecent',
  indexes: [ { fields: [ 'accountId', { name: 'lastPlayedAt', order: 'DESC' } ] } ]
})
export class GameRecentModel extends SequelizeModel<GameRecentModel> {
  @AllowNull(false)
  @ForeignKey(() => GameModel)
  @PrimaryKey
  @Column
  declare gameId: number

  @BelongsTo(() => GameModel, { foreignKey: 'gameId', onDelete: 'CASCADE' })
  declare Game: Awaited<GameModel>

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @PrimaryKey
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, { foreignKey: 'accountId', onDelete: 'CASCADE' })
  declare Account: Awaited<AccountModel>

  @AllowNull(false)
  @Column
  declare lastPlayedAt: Date

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
