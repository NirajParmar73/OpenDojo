<template>
  <UPopover :content="{ align: 'end', side: 'bottom', sideOffset: 8 }">
    <UButton color="neutral" variant="outline" square aria-label="Open notifications" class="relative">
      <UIcon name="i-lucide-bell" class="h-4 w-4" />
      <span v-if="data.unreadCount" class="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
        {{ data.unreadCount > 99 ? '99+' : data.unreadCount }}
      </span>
    </UButton>

    <template #content>
      <div class="w-[min(24rem,calc(100vw-2rem))] overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div><p class="font-semibold">Notifications</p><p class="text-xs text-slate-500">{{ data.unreadCount }} unread</p></div>
          <UButton v-if="data.unreadCount" size="xs" color="neutral" variant="ghost" @click="markAllRead">Mark all read</UButton>
        </div>
        <div v-if="data.items.length" class="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          <button
            v-for="item in data.items"
            :key="item.id"
            class="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
            :class="!item.read ? 'bg-primary/5' : ''"
            @click="open(item)"
          >
            <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" :class="iconClass(item)">
              <UIcon :name="item.kind === 'fee' ? 'i-lucide-receipt-indian-rupee' : 'i-lucide-megaphone'" class="h-4 w-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-start gap-2"><span class="flex-1 text-sm font-medium">{{ item.title }}</span><span v-if="!item.read" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /></span>
              <span class="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{{ item.message }}</span>
              <span class="mt-1 block text-[11px] text-slate-400">{{ formatDate(item.createdAt) }}</span>
            </span>
          </button>
        </div>
        <div v-else class="px-5 py-10 text-center"><UIcon name="i-lucide-bell-off" class="mx-auto h-7 w-7 text-slate-300" /><p class="mt-2 text-sm text-slate-500">You're all caught up.</p></div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import type { StudentNotification } from '~/composables/useStudentNotifications'

const { data, refresh, markRead, markAllRead } = useStudentNotifications()
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  void refresh()
  timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 120_000)
  document.addEventListener('visibilitychange', refreshWhenVisible)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})
function refreshWhenVisible() { if (document.visibilityState === 'visible') void refresh() }
async function open(item: StudentNotification) {
  if (!item.read) await markRead(item.id)
  if (item.actionUrl) await navigateTo(item.actionUrl)
}
function iconClass(item: StudentNotification) {
  if (item.severity === 'urgent') return 'bg-red-500/10 text-red-600 dark:text-red-400'
  if (item.severity === 'warning') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  if (item.severity === 'success') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  return 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
}
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) }
</script>

