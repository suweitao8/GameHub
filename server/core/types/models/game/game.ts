import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { MAccountActor } from '../account/account.js'

export type GameStatus = 'pending' | 'published' | 'rejected' | 'unlisted' | 'blocked'

type Use<K extends keyof GameModel, M> = PickWith<GameModel, K, M>

// ############################################################################

// Base game type: keep all scalar columns plus the Owner/StatsSummary Sequelize
// associations. GameModel declares both associations on the class
// (`declare Owner: AccountModel`, `declare StatsSummary: GameStatsSummaryModel | null`),
// so including them here lets controllers read `game.Owner` / `game.StatsSummary`
// without `as any` casts.
//
// `Video` does not exist as an association on GameModel, so it is kept in the
// Omit only to preserve the previous type surface for any downstream consumer
// that referenced it (a no-op Omit is harmless).
export type MGame = Omit<GameModel, 'Video'>

// ############################################################################

// Typed association helpers (mirrors the MVideo pattern), for sites that want
// to narrow the association shape instead of carrying the full GameModel.

// Game with its owner account and the owner's Actor (handle/displayName/avatars).
export type MGameOwner =
  & Omit<GameModel, 'Video' | 'Owner'>
  & Use<'Owner', MAccountActor>

// Game with an optional stats summary row.
export type MGameStatsSummary =
  & Omit<GameModel, 'Video' | 'StatsSummary'>
  & PickWithOpt<GameModel, 'StatsSummary', GameStatsSummaryModel>
