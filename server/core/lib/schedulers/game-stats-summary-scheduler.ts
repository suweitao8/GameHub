import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers', 'game-stats')

/**
 * Periodically refresh the denormalized game stats summary table to keep
 * list queries fast and avoid expensive subquery aggregates on every read.
 */

export class GameStatsSummaryScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = 60_000 // 1 minute

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  protected async internalExecute () {
    logger.debug('Running game stats summary refresh scheduler', lTags())

    try {
      await GameStatsSummaryModel.refreshAll()
      logger.info('Game stats summary refresh completed', lTags())
    } catch (err) {
      logger.error('Failed to refresh game stats summary', { err, ...lTags() })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
