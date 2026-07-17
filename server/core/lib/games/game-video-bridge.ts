import { VideoCommentPolicy, VideoEmbedPrivacyPolicy, VideoPrivacy, VideoState } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { CONFIG } from '@server/initializers/config.js'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFull } from '@server/types/models/index.js'
import { GameModel } from '@server/models/game/game.js'
import type { MGame } from '../../types/models/game/game.js'

/**
 * Creates the lightweight PeerTube content shell used by community features.
 * The actual game runtime remains outside the video/media tree and is never
 * served as a video file.
 */
export async function ensureGameVideo (game: MGame): Promise<MVideoFull | null> {
  if (game.videoId) return VideoModel.loadFull(game.videoId)

  const channel = await VideoChannelModel.findOne({
    where: { accountId: game.ownerAccountId }
  })
  if (!channel) return null

  const video = new VideoModel({
    uuid: buildUUID(),
    name: game.title,
    category: null,
    licence: CONFIG.DEFAULTS.PUBLISH.LICENCE,
    language: 'en',
    privacy: VideoPrivacy.PUBLIC,
    nsfw: false,
    nsfwFlags: 0,
    nsfwSummary: null,
    description: game.description || null,
    support: null,
    duration: 0,
    views: 0,
    downloads: 0,
    likes: 0,
    dislikes: 0,
    comments: 0,
    remote: false,
    isLive: false,
    commentsPolicy: VideoCommentPolicy.ENABLED,
    downloadEnabled: false,
    embedPrivacyPolicy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
    waitTranscoding: false,
    state: VideoState.PUBLISHED,
    aspectRatio: null,
    publishedAt: new Date(),
    originallyPublishedAt: null,
    firstPublishedAt: new Date(),
    channelId: channel.id
  })
  video.url = getLocalVideoActivityPubUrl(video)

  await video.save()

  game.videoId = video.id
  await GameModel.update({ videoId: video.id }, { where: { id: game.id } })

  return VideoModel.loadFull(video.id)
}
