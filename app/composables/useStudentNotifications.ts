export type StudentNotification = {
  id: string
  kind: 'fee' | 'announcement'
  title: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'urgent'
  actionUrl: string | null
  read: boolean
  createdAt: string
  billingPeriod: string | null
  outstandingAmount: number | null
}

type NotificationResponse = {
  items: StudentNotification[]
  unreadCount: number
  overdue: StudentNotification[]
  urgentAnnouncements: StudentNotification[]
}

export function useStudentNotifications() {
  const data = useState<NotificationResponse>('student-notifications', () => ({ items: [], unreadCount: 0, overdue: [], urgentAnnouncements: [] }))
  const pending = useState('student-notifications-pending', () => false)

  async function refresh() {
    if (pending.value) return
    pending.value = true
    try {
      data.value = await $fetch<NotificationResponse>('/api/portal/notifications')
    } catch {
      // Keep the last successful inbox during transient connectivity failures.
    } finally {
      pending.value = false
    }
  }

  async function markRead(id: string) {
    await $fetch(`/api/portal/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
    const item = data.value.items.find(notification => notification.id === id)
    if (item && !item.read) {
      item.read = true
      data.value.unreadCount = Math.max(0, data.value.unreadCount - 1)
    }
  }

  async function markAllRead() {
    await $fetch('/api/portal/notifications/read-all', { method: 'POST' })
    data.value.items.forEach(item => { item.read = true })
    data.value.unreadCount = 0
  }

  return { data, pending, refresh, markRead, markAllRead }
}
