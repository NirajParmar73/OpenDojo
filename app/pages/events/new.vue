<template><div class="mx-auto max-w-4xl"><UButton to="/events" variant="ghost" icon="i-lucide-arrow-left" class="mb-4">All events</UButton><EventEditor v-if="data?.canCreate" :currency="data.currency" @saved="saved" @cancel="navigateTo('/events')" /><UAlert v-else title="Only event managers can create events" /></div></template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { data } = await useFetch<any>('/api/events')
function saved(event: any) { navigateTo(`/events/${event.id}`) }
</script>
