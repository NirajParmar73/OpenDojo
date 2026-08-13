<template>
  <div v-if="data.overdue.length || unreadUrgent.length" class="mx-auto mb-5 max-w-5xl space-y-3">
    <UAlert
      v-if="data.overdue.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="data.overdue.length === 1 ? data.overdue[0]!.title : `${data.overdue.length} fee periods are overdue`"
      :description="overdueDescription"
      :actions="[{ label: 'View fees', color: 'warning', variant: 'soft', onClick: openFees }]"
    />
    <UAlert
      v-for="item in unreadUrgent"
      :key="item.id"
      color="error"
      variant="subtle"
      icon="i-lucide-megaphone"
      :title="item.title"
      :description="item.message"
      close
      @update:open="(open) => { if (!open) void markRead(item.id) }"
    />
  </div>
</template>

<script setup lang="ts">
const { data, markRead } = useStudentNotifications()
const unreadUrgent = computed(() => data.value.urgentAnnouncements.filter(item => !item.read))
const overdueDescription = computed(() => data.value.overdue.length === 1
  ? data.value.overdue[0]!.message
  : `You have outstanding balances across ${data.value.overdue.length} billing periods. Open Fees for the detailed payment history.`)
async function openFees() {
  await Promise.all(data.value.overdue.filter(item => !item.read).map(item => markRead(item.id)))
  await navigateTo('/portal?tab=fees')
}
</script>
