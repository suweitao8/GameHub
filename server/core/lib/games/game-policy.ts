import { UserRole } from '@peertube/peertube-models'
import type { GameStatus } from '@server/types/models/game/game.js'

export type GameUser = {
  id: number
  role: number
  Account: { id: number }
}

export type GamePolicyRecord = {
  ownerAccountId: number
  status: GameStatus
}

export type GameModerationAction = 'approve' | 'reject' | 'unlist' | 'block'

export function isGameModerator (user: GameUser) {
  return user.role === UserRole.ADMINISTRATOR || user.role === UserRole.MODERATOR
}

export function canManageGame (game: GamePolicyRecord, user: GameUser) {
  return isGameModerator(user) || game.ownerAccountId === user.Account.id
}

export function getModerationStatus (action: string, currentStatus: GameStatus): GameStatus | null {
  if (action === 'approve' && [ 'pending', 'rejected', 'unlisted' ].includes(currentStatus)) return 'published'
  if (action === 'reject' && currentStatus === 'pending') return 'rejected'
  if (action === 'unlist' && currentStatus === 'published') return 'unlisted'
  if (action === 'block' && currentStatus !== 'blocked') return 'blocked'

  return null
}
