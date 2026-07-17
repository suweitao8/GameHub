import { GameModel } from '@server/models/game/game.js'

export type GameStatus = 'pending' | 'published' | 'rejected' | 'unlisted' | 'blocked'

export type MGame = Omit<GameModel, 'Owner' | 'Video'>
