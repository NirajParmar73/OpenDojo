<template>
  <div class="mx-auto max-w-5xl">
    <section class="mb-6">
      <p class="text-sm font-semibold text-primary">STUDENT COMMUNICATION</p>
      <h2 class="mt-1 text-2xl font-semibold">Announcements</h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Publish notices to every student in the organization or to one dojo. Students see them in the web portal and installed PWA.</p>
    </section>

    <UCard>
      <template #header><h3 class="font-semibold">{{ editingId ? 'Edit announcement' : 'New announcement' }}</h3></template>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <UFormField label="Title" required class="sm:col-span-2"><UInput v-model="form.title" maxlength="160" required class="w-full" /></UFormField>
        <UFormField label="Audience" required>
          <USelect v-model="form.audience" :items="audienceOptions" class="w-full" />
        </UFormField>
        <UFormField label="Importance">
          <USelect v-model="form.severity" :items="severityOptions" class="w-full" />
        </UFormField>
        <UFormField label="Publish at" required><UInput v-model="form.publishedAt" type="datetime-local" required class="w-full" /></UFormField>
        <UFormField label="Expires at" hint="Optional"><UInput v-model="form.expiresAt" type="datetime-local" class="w-full" /></UFormField>
        <UFormField label="Message" required class="sm:col-span-2"><UTextarea v-model="form.message" :rows="5" maxlength="5000" required class="w-full" /></UFormField>
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" icon="i-lucide-send" :loading="saving">{{ editingId ? 'Save changes' : 'Publish announcement' }}</UButton>
          <UButton v-if="editingId" type="button" color="neutral" variant="ghost" @click="resetForm">Cancel</UButton>
        </div>
      </form>
    </UCard>

    <UCard class="mt-6">
      <template #header><div><h3 class="font-semibold">Published and scheduled</h3><p class="mt-1 text-sm text-slate-500">Expired announcements remain here for staff records but disappear from student portals.</p></div></template>
      <div v-if="announcements?.length" class="divide-y divide-slate-100 dark:divide-slate-800">
        <article v-for="announcement in announcements" :key="announcement.id" class="py-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2"><h4 class="font-medium">{{ announcement.title }}</h4><UBadge :color="severityColor(announcement.severity)" variant="subtle">{{ announcement.severity }}</UBadge><UBadge color="neutral" variant="subtle">{{ statusOf(announcement) }}</UBadge></div>
              <p class="mt-1 text-xs text-slate-500">{{ audienceLabel(announcement) }} · {{ formatDateTime(announcement.publishedAt) }}<span v-if="announcement.expiresAt"> · expires {{ formatDateTime(announcement.expiresAt) }}</span></p>
              <p class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{{ announcement.message }}</p>
            </div>
            <div class="flex gap-2"><UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="edit(announcement)">Edit</UButton><UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :loading="deletingId === announcement.id" @click="remove(announcement)">Delete</UButton></div>
          </div>
        </article>
      </div>
      <p v-else class="py-10 text-center text-sm text-slate-500">No announcements have been published.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type Dojo = { id: number, name: string }
type HierarchyNode = { id: number, name: string, label?: string, children: HierarchyNode[] }
type Announcement = { id: number, title: string, message: string, severity: 'info' | 'success' | 'warning' | 'urgent', dojoId: number | null, scopeNodeId: number | null, publishedAt: string, expiresAt: string | null, dojo: Dojo | null, scopeNode: HierarchyNode | null }
const { user } = useUserSession()
const toast = useToast()
const saving = ref(false)
const editingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const { data: announcements, refresh } = await useFetch<Announcement[]>('/api/announcements')
const { data: dojos } = await useFetch<Dojo[]>('/api/dojos')
const { data: hierarchyTree } = await useFetch<HierarchyNode[]>('/api/hierarchy/nodes')
const { data: permissions } = await useFetch<{ managedParentNodeIds: number[] }>('/api/users/me/permissions')
const localDateTime = (value = new Date()) => {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}
const form = reactive({ title: '', message: '', severity: 'info', audience: '', publishedAt: localDateTime(), expiresAt: '' })
const severityOptions = [{ label: 'Information', value: 'info' }, { label: 'Success', value: 'success' }, { label: 'Warning', value: 'warning' }, { label: 'Urgent', value: 'urgent' }]
const flattenNodes = (nodes: HierarchyNode[], depth = 0): Array<HierarchyNode & { depth: number }> => nodes.flatMap(node => [{ ...node, depth }, ...flattenNodes(node.children || [], depth + 1)])
const territoryNodes = computed(() => flattenNodes(hierarchyTree.value || []).filter(node => ['owner', 'admin'].includes(user.value?.role || '') || permissions.value?.managedParentNodeIds.includes(node.id)))
const audienceOptions = computed(() => [
  ...(['owner', 'admin'].includes(user.value?.role || '') ? [{ label: 'Entire organization', value: 'organization' }] : []),
  ...territoryNodes.value.map(node => ({ label: `Territory: ${'— '.repeat(node.depth)}${node.label || node.name} (all dojos)`, value: `territory:${node.id}` })),
  ...(dojos.value || []).map(dojo => ({ label: dojo.name, value: `dojo:${dojo.id}` })),
])
watchEffect(() => { if (!form.audience && audienceOptions.value.length) form.audience = audienceOptions.value[0]!.value })

function resetForm() { Object.assign(form, { title: '', message: '', severity: 'info', audience: audienceOptions.value[0]?.value || '', publishedAt: localDateTime(), expiresAt: '' }); editingId.value = null }
function audienceIds() { const [type, id] = form.audience.split(':'); return { dojoId: type === 'dojo' ? Number(id) : null, scopeNodeId: type === 'territory' ? Number(id) : null } }
function edit(item: Announcement) { editingId.value = item.id; Object.assign(form, { title: item.title, message: item.message, severity: item.severity, audience: item.dojoId ? `dojo:${item.dojoId}` : item.scopeNodeId ? `territory:${item.scopeNodeId}` : 'organization', publishedAt: localDateTime(new Date(item.publishedAt)), expiresAt: item.expiresAt ? localDateTime(new Date(item.expiresAt)) : '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function save() {
  saving.value = true
  try {
    const body = { title: form.title, message: form.message, severity: form.severity, ...audienceIds(), publishedAt: new Date(form.publishedAt).toISOString(), expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null }
    await $fetch(editingId.value ? `/api/announcements/${editingId.value}` : '/api/announcements', { method: editingId.value ? 'PATCH' : 'POST', body })
    const edited = Boolean(editingId.value); resetForm(); await refresh(); toast.add({ color: 'success', title: edited ? 'Announcement updated' : 'Announcement published' })
  } catch (error: any) { toast.add({ color: 'error', title: 'Could not save announcement', description: error.data?.statusMessage || error.message }) } finally { saving.value = false }
}
async function remove(item: Announcement) {
  if (!confirm(`Delete “${item.title}”?`)) return
  deletingId.value = item.id
  try { await $fetch(`/api/announcements/${item.id}`, { method: 'DELETE' }); if (editingId.value === item.id) resetForm(); await refresh(); toast.add({ color: 'success', title: 'Announcement deleted' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not delete announcement', description: error.data?.statusMessage || error.message }) } finally { deletingId.value = null }
}
function statusOf(item: Announcement) { const now = Date.now(); return new Date(item.publishedAt).getTime() > now ? 'Scheduled' : item.expiresAt && new Date(item.expiresAt).getTime() <= now ? 'Expired' : 'Active' }
function audienceLabel(item: Announcement) { return item.dojo?.name || (item.scopeNode ? `${item.scopeNode.label || item.scopeNode.name} · all territory dojos` : 'Entire organization') }
function severityColor(value: Announcement['severity']) { return value === 'urgent' ? 'error' : value === 'warning' ? 'warning' : value === 'success' ? 'success' : 'info' }
function formatDateTime(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }
</script>
