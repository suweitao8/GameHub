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
import { AccountModel } from '../account/account.js'

export type GameEventType = 'activity' | 'competition'
export type GameEventStatus = 'upcoming' | 'ongoing' | 'ended' | 'cancelled'

@Table({
  tableName: 'gameEvent',
  indexes: [
    { fields: [ 'slug' ], unique: true },
    { fields: [ 'status', 'startAt' ] },
    { fields: [ 'type', 'status' ] }
  ]
})
export class GameEventModel extends SequelizeModel<GameEventModel> {
  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare title: string

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string | null

  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare slug: string

  @AllowNull(false)
  @Default('activity')
  @Column(DataType.STRING(32))
  declare type: GameEventType

  @AllowNull(false)
  @Default('upcoming')
  @Column(DataType.STRING(32))
  declare status: GameEventStatus

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare coverPath: string | null

  @AllowNull(true)
  @Column(DataType.DATE)
  declare startAt: Date | null

  @AllowNull(true)
  @Column(DataType.DATE)
  declare endAt: Date | null

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare rules: string | null

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare prizes: string | null

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare maxParticipants: number

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare participantCount: number

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare createdByAccountId: number

  @BelongsTo(() => AccountModel, { foreignKey: { allowNull: false, name: 'createdByAccountId' } })
  declare Creator: Awaited<AccountModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}

@Table({
  tableName: 'gameEventParticipant',
  indexes: [
    { fields: [ 'eventId', 'accountId' ], unique: true },
    { fields: [ 'eventId' ] }
  ]
})
export class GameEventParticipantModel extends SequelizeModel<GameEventParticipantModel> {
  @AllowNull(false)
  @ForeignKey(() => GameEventModel)
  @Column
  declare eventId: number

  @BelongsTo(() => GameEventModel, { foreignKey: { allowNull: false } })
  declare Event: Awaited<GameEventModel>

  @AllowNull(false)
  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, { foreignKey: { allowNull: false } })
  declare Account: Awaited<AccountModel>

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare entryData: string | null

  @AllowNull(false)
  @Default('registered')
  @Column(DataType.STRING(32))
  declare state: 'registered' | 'submitted' | 'winner' | 'disqualified'

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare rank: number | null

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date
}
