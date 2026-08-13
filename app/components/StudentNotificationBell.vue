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
        <div class="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <div class="flex items-center gap-2 text-xs text-slate-500"><UIcon :name="soundEnabled ? 'i-lucide-volume-2' : 'i-lucide-volume-x'" class="h-4 w-4" />Notification sounds</div>
          <button
            type="button"
            role="switch"
            :aria-checked="soundEnabled"
            class="relative h-5 w-9 rounded-full transition"
            :class="soundEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'"
            @click="toggleSound"
          >
            <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all" :class="soundEnabled ? 'left-[18px]' : 'left-0.5'" />
            <span class="sr-only">{{ soundEnabled ? 'Disable' : 'Enable' }} notification sounds</span>
          </button>
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
let audioContext: AudioContext | undefined
let inboxInitialized = false
let knownUnreadIds = new Set<string>()
const soundEnabled = ref(false)

onMounted(() => {
  soundEnabled.value = localStorage.getItem('opendojos-student-notification-sound') === 'enabled'
  void refreshInbox()
  timer = setInterval(() => { if (document.visibilityState === 'visible') void refreshInbox() }, 120_000)
  document.addEventListener('visibilitychange', refreshWhenVisible)
  window.addEventListener('pointerdown', unlockAudio, { once: true })
  window.addEventListener('keydown', unlockAudio, { once: true })
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
  void audioContext?.close()
})
function getAudioContext() {
  audioContext ||= new AudioContext()
  return audioContext
}
async function unlockAudio() {
  if (!soundEnabled.value) return
  const context = getAudioContext()
  if (context.state === 'suspended') await context.resume()
}
async function playChime() {
  if (!soundEnabled.value) return
  const context = getAudioContext()
  if (context.state === 'suspended') {
    try { await context.resume() } catch { return }
  }
  if (context.state !== 'running') return
  const start = context.currentTime + 0.01
  const compressor = context.createDynamicsCompressor()
  const masterGain = context.createGain()

  compressor.threshold.setValueAtTime(-16, start)
  compressor.knee.setValueAtTime(10, start)
  compressor.ratio.setValueAtTime(5, start)
  compressor.attack.setValueAtTime(0.003, start)
  compressor.release.setValueAtTime(0.18, start)
  masterGain.gain.setValueAtTime(0.7, start)
  masterGain.connect(compressor)
  compressor.connect(context.destination)

  const playNote = (offset: number, frequency: number, duration: number) => {
    const noteStart = start + offset
    for (const [type, multiplier, peak] of [
      ['triangle', 1, 0.42],
      ['sine', 2, 0.1],
    ] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency * multiplier, noteStart)
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(peak, noteStart + 0.012)
      gain.gain.exponentialRampToValueAtTime(peak * 0.55, noteStart + 0.12)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration)
      oscillator.connect(gain)
      gain.connect(masterGain)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + duration + 0.02)
    }
  }

  // A bright, original two-note interval with enough sustain to cut through ambient noise.
  playNote(0, 783.99, 0.42)
  playNote(0.18, 1046.5, 0.62)
}
async function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  localStorage.setItem('opendojos-student-notification-sound', soundEnabled.value ? 'enabled' : 'disabled')
  if (soundEnabled.value) await playChime()
}
async function refreshInbox() {
  await refresh()
  const unreadIds = new Set(data.value.items.filter(item => !item.read).map(item => item.id))
  if (inboxInitialized && [...unreadIds].some(id => !knownUnreadIds.has(id))) await playChime()
  knownUnreadIds = unreadIds
  inboxInitialized = true
}
function refreshWhenVisible() { if (document.visibilityState === 'visible') void refreshInbox() }
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
