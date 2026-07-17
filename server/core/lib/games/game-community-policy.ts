export function canDeleteGameComment (options: {
  commentAccountId: number | null
  userAccountId: number
  gameOwnerAccountId: number
  canManageAny: boolean
}) {
  return options.canManageAny || options.commentAccountId === options.userAccountId || options.gameOwnerAccountId === options.userAccountId
}

export function updateCommentLikeCount (options: { liked: boolean; likes: number; nextLiked: boolean }) {
  if (options.liked === options.nextLiked) return { liked: options.liked, likes: Math.max(0, options.likes) }

  return {
    liked: options.nextLiked,
    likes: Math.max(0, options.likes + (options.nextLiked ? 1 : -1))
  }
}

export function isGameCommentVisible (comment: { isDeleted?: boolean; deletedAt?: Date | string | null }) {
  return comment.isDeleted !== true && !comment.deletedAt
}
