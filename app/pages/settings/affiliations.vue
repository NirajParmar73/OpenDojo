<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div>
      <p class="text-sm font-semibold text-primary">ORGANIZATION</p>
      <h2 class="mt-1 text-2xl font-semibold">Affiliations & memberships</h2>
      <p class="mt-2 text-sm text-slate-500">Record and maintain memberships for areas you are responsible for.</p>
    </div>

    <UCard v-if="isOwner">
      <template #header><h3 class="font-semibold">Governing body directory</h3></template>
      <form class="grid gap-4 sm:grid-cols-3" @submit.prevent="addBody">
        <UFormField label="Name" required><UInput v-model="bodyForm.name" placeholder="Governing body name" required /></UFormField>
        <UFormField label="Level" required><USelect v-model="bodyForm.level" :items="bodyLevels" /></UFormField>
        <div class="self-end"><UButton type="submit" class="w-full" :loading="savingBody">Add governing body</UButton></div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <div><h3 class="font-semibold">{{ editingAffiliation ? 'Edit membership' : 'Record membership' }}</h3><p class="mt-1 text-sm text-slate-500">Choose the governing body and where this relationship applies.</p></div>
      </template>
      <form class="grid gap-4 sm:grid-cols-3" @submit.prevent="saveAffiliation">
        <UFormField label="Governing body" required><USelect v-model="form.governingBodyId" :items="bodyOptions" placeholder="Select governing body" required /></UFormField>
        <UFormField label="Relationship" required><USelect v-model="form.relationshipType" :items="relationshipTypes" /></UFormField>
        <UFormField label="Applies to" required><USelect v-model="form.scopeType" :items="scopeTypes" @update:model-value="form.scopeId = null" /></UFormField>
        <UFormField v-if="form.scopeType !== 'organization'" :label="form.scopeType === 'dojo' ? 'Dojo' : 'Hierarchy node'" required><USelect v-model="form.scopeId" :items="scopeOptions" placeholder="Select location" required /></UFormField>
        <UFormField label="Renewal due date"><UInput v-model="form.renewalDueAt" type="date" /></UFormField>
        <UFormField label="Status" required><USelect v-model="form.status" :items="statusOptions" /></UFormField>
        <div class="flex items-end gap-2 sm:col-span-3"><UButton type="submit" :loading="saving">{{ editingAffiliation ? 'Save changes' : 'Record affiliation' }}</UButton><UButton v-if="editingAffiliation" type="button" color="neutral" variant="ghost" @click="resetForm">Cancel</UButton></div>
      </form>
    </UCard>

    <UCard>
      <template #header><h3 class="font-semibold">Current relationships</h3></template>
      <div v-if="affiliations?.length" class="divide-y divide-slate-100 dark:divide-slate-800">
        <div v-for="item in affiliations" :key="item.id" class="flex items-center justify-between gap-4 py-4">
          <div><p class="font-medium">{{ item.governingBody.name }}</p><p class="mt-1 text-sm capitalize text-slate-500">{{ item.relationshipType.replaceAll('_', ' ') }} · {{ item.scopeType }}<span v-if="item.renewalDueAt"> · Renewal {{ formatDate(item.renewalDueAt) }}</span></p></div>
          <div class="flex items-center gap-2"><UBadge class="capitalize" color="primary">{{ item.status }}</UBadge><UButton size="xs" color="primary" variant="soft" @click="startEdit(item)">Edit</UButton><UButton size="xs" color="error" variant="ghost" @click="deleteAffiliation(item.id)">Delete</UButton></div>
        </div>
      </div>
      <p v-else class="py-8 text-center text-sm text-slate-500">No affiliations recorded.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useUserSession()
const isOwner = computed(() => user.value?.role === 'owner')
const toast = useToast()
const saving = ref(false)
const savingBody = ref(false)
const editingAffiliation = ref<any>(null)
const bodyForm = reactive({ name: '', level: 'other' })
const form = reactive({ governingBodyId: undefined as number | undefined, relationshipType: 'membership', scopeType: 'organization', scopeId: null as number | null, renewalDueAt: '', status: 'active' })
const relationshipTypes = ['parent_affiliation', 'membership', 'recognition', 'license', 'accreditation'].map(value => ({ label: value.replaceAll('_', ' '), value }))
const statusOptions = ['pending', 'active', 'expired', 'suspended'].map(value => ({ label: value, value }))
const bodyLevels = ['international', 'national', 'state', 'district', 'city', 'local', 'other'].map(value => ({ label: value, value }))
const { data: bodies, refresh: refreshBodies } = await useFetch<any[]>('/api/governing-bodies')
const { data: affiliations, refresh } = await useFetch<any[]>('/api/affiliations')
const { data: permissions } = await useFetch<any>('/api/users/me/permissions')
const { data: nodes } = await useFetch<any[]>('/api/hierarchy/nodes')
const { data: dojos } = await useFetch<any[]>('/api/dojos')

const bodyOptions = computed(() => (bodies.value || []).map(item => ({ label: item.name, value: item.id })))
const scopeTypes = computed(() => isOwner.value ? [{ label: 'Organization-wide', value: 'organization' }, { label: 'Hierarchy node', value: 'node' }, { label: 'Dojo', value: 'dojo' }] : [{ label: 'Hierarchy node', value: 'node' }, { label: 'Dojo', value: 'dojo' }])
const flatNodes = computed(() => flattenNodes(nodes.value || []))
const scopeOptions = computed(() => form.scopeType === 'dojo' ? (dojos.value || []).filter(dojo => isOwner.value || permissions.value?.allowedDojoIds?.includes(dojo.id)).map(dojo => ({ label: dojo.name, value: dojo.id })) : flatNodes.value.filter(node => isOwner.value || permissions.value?.allowedNodeIds?.includes(node.id)).map(node => ({ label: node.name, value: node.id })))

function flattenNodes(tree: any[]): any[] { return tree.flatMap(node => [node, ...flattenNodes(node.children || [])]) }
function formatDate(value: string | Date) { return new Date(value).toLocaleDateString() }
function resetForm() { Object.assign(form, { governingBodyId: undefined, relationshipType: 'membership', scopeType: isOwner.value ? 'organization' : 'node', scopeId: null, renewalDueAt: '', status: 'active' }); editingAffiliation.value = null }
function startEdit(item: any) { editingAffiliation.value = item; Object.assign(form, { governingBodyId: item.governingBodyId, relationshipType: item.relationshipType, scopeType: item.scopeType, scopeId: item.scopeId, renewalDueAt: item.renewalDueAt ? new Date(item.renewalDueAt).toISOString().slice(0, 10) : '', status: item.status }) }
async function addBody() { if (!bodyForm.name.trim()) return; savingBody.value = true; try { await $fetch('/api/governing-bodies', { method: 'POST', body: bodyForm }); bodyForm.name = ''; await refreshBodies(); toast.add({ color: 'success', title: 'Governing body added' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not add governing body', description: error.data?.statusMessage || error.message }) } finally { savingBody.value = false } }
async function saveAffiliation() { if (!form.governingBodyId || (form.scopeType !== 'organization' && !form.scopeId)) { toast.add({ color: 'warning', title: 'Select a governing body and location' }); return }; saving.value = true; try { const payload = { ...form, renewalDueAt: form.renewalDueAt || null }; if (editingAffiliation.value) await $fetch(`/api/affiliations/${editingAffiliation.value.id}`, { method: 'PATCH', body: payload }); else await $fetch('/api/affiliations', { method: 'POST', body: payload }); await refresh(); toast.add({ color: 'success', title: editingAffiliation.value ? 'Affiliation updated' : 'Affiliation recorded' }); resetForm() } catch (error: any) { toast.add({ color: 'error', title: 'Could not save affiliation', description: error.data?.statusMessage || error.message }) } finally { saving.value = false } }
async function deleteAffiliation(id: number) { if (!confirm('Delete this affiliation or membership record?')) return; try { await $fetch(`/api/affiliations/${id}`, { method: 'DELETE' }); await refresh(); if (editingAffiliation.value?.id === id) resetForm(); toast.add({ color: 'success', title: 'Affiliation deleted' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not delete affiliation', description: error.data?.statusMessage || error.message }) } }

watch(isOwner, (value) => { if (!value && form.scopeType === 'organization') form.scopeType = 'node' }, { immediate: true })
</script>
