import { GameNotification } from './games.service'

export function markGameNotificationRead (notifications: GameNotification[], id: number) {
  let changed = false
  const next = notifications.map(notification => {
    if (notification.id !== id || notification.read) return notification

    changed = true
    return { ...notification, read: true }
  })

  return { notifications: next, changed }
}

export function markAllGameNotificationsRead (notifications: GameNotification[]) {
  return notifications.map(notification => notification.read ? notification : { ...notification, read: true })
}
