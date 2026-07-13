<template>
  <div class="mx-auto max-w-5xl">
    <section class="mb-7 max-w-3xl">
      <p class="text-sm font-semibold text-primary">ORGANIZATION</p>
      <h2 class="mt-1 text-2xl font-semibold">Audit log</h2>
      <p class="mt-2 text-sm leading-6 text-slate-500">A read-only record of important changes in your permitted hierarchy and dojos. Organization-wide events are visible only to the owner.</p>
    </section>

    <UCard>
      <div v-if="logs?.length" class="divide-y divide-slate-200 dark:divide-slate-800">
        <article v-for="log in logs" :key="log.id" class="flex gap-4 py-4 first:pt-0 last:pb-0">
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UIcon :name="iconFor(log.action)" class="h-4 w-4" /></div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p class="font-medium">{{ describe(log) }}</p><time class="shrink-0 text-xs text-slate-500">{{ formatDateTime(log.createdAt) }}</time></div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400"><span class="font-medium text-slate-700 dark:text-slate-200">{{ log.actor?.name || 'System' }}</span><span v-if="log.details"> · {{ log.details }}</span></p>
          </div>
        </article>
      </div>
      <div v-else class="py-12 text-center"><UIcon name="i-lucide-scroll-text" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" /><p class="mt-3 font-medium">No audit events in your permitted scope</p><p class="mt-1 text-sm text-slate-500">New hierarchy, grading, and achievement changes will appear here.</p></div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type AuditLog = { id: number, action: string, targetLabel: string, details: string | null, createdAt: string, actor: { name: string } | null }
const { data: logs } = await useFetch<AuditLog[]>('/api/audit-logs')
const actionLabel: Record<string, string> = {
  'achievement.recorded': 'recorded an achievement for', 'achievement.deleted': 'deleted an achievement for',
  'grading.recorded': 'recorded a grading for', 'grading.deleted': 'deleted a grading for',
  'hierarchy_node.created': 'created hierarchy node', 'hierarchy_node.updated': 'updated hierarchy node', 'hierarchy_node.deleted': 'deleted hierarchy node',
  'payment.recorded': 'recorded a payment for', 'student.updated': 'updated student', 'student.archived': 'archived student',
  'user.access_updated': 'updated staff access for',
}
function describe(log: AuditLog) { return `${actionLabel[log.action] || log.action}: ${log.targetLabel}` }
function iconFor(action: string) { return action.startsWith('achievement') ? 'i-lucide-trophy' : action.startsWith('grading') ? 'i-lucide-award' : action.startsWith('payment') ? 'i-lucide-receipt-indian-rupee' : action.startsWith('student') || action.startsWith('user') ? 'i-lucide-user-round' : 'i-lucide-network' }
function formatDateTime(value: string) { return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }
</script>
