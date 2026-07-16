<template>
  <div class="mx-auto max-w-4xl">
    <section class="mb-6"><p class="text-sm font-semibold text-primary">ORGANIZATION</p><h2 class="mt-1 text-2xl font-semibold">Martial arts & programs</h2><p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Manage the disciplines and styles your organization teaches.</p></section>

    <UCard>
      <form class="grid gap-4 sm:grid-cols-3" @submit.prevent="saveProgram">
        <UFormField label="Martial art" required><UInput v-model="form.martialArt" placeholder="e.g. Karate" required /></UFormField>
        <UFormField label="Style / lineage" required><UInput v-model="form.style" placeholder="e.g. Goju-ryu" required /></UFormField>
        <div class="flex items-end gap-2"><UButton type="submit" :loading="saving" :icon="editingId ? 'i-lucide-save' : 'i-lucide-plus'">{{ editingId ? 'Save changes' : 'Add program' }}</UButton><UButton v-if="editingId" type="button" color="neutral" variant="ghost" @click="resetForm">Cancel</UButton></div>
      </form>
    </UCard>

    <UCard class="mt-6">
      <template #header><h3 class="font-semibold">Active programs</h3></template>
      <div v-if="programs?.length" class="divide-y divide-slate-100 dark:divide-slate-800">
        <div v-for="program in programs" :key="program.id" class="flex items-center justify-between gap-4 py-4">
          <div><p class="font-medium">{{ program.displayName }}</p><p class="mt-1 text-sm text-slate-500">{{ program.martialArt }} · {{ program.style }}</p></div>
          <div class="flex items-center gap-2"><UBadge v-if="program.isPrimary" color="primary">Primary</UBadge><UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="editProgram(program)">Edit</UButton><UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :loading="deletingId === program.id" @click="deleteProgram(program)">Delete</UButton></div>
        </div>
      </div>
      <p v-else class="py-8 text-center text-sm text-slate-500">No programs configured.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

type Program = { id: number, martialArt: string, style: string, displayName: string, isPrimary: number }
const toast = useToast()
const saving = ref(false)
const deletingId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const form = reactive({ martialArt: '', style: '' })
const { data: programs, refresh } = await useFetch<Program[]>('/api/organization/programs')

function resetForm() {
  Object.assign(form, { martialArt: '', style: '' })
  editingId.value = null
}

function editProgram(program: Program) {
  editingId.value = program.id
  Object.assign(form, { martialArt: program.martialArt, style: program.style })
}

async function saveProgram() {
  saving.value = true
  try {
    await $fetch(editingId.value ? `/api/organization/programs/${editingId.value}` : '/api/organization/programs', { method: editingId.value ? 'PATCH' : 'POST', body: form })
    const edited = Boolean(editingId.value)
    resetForm()
    await refresh()
    toast.add({ color: 'success', title: edited ? 'Program updated' : 'Program added' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not save program', description: error.data?.statusMessage || error.message })
  } finally {
    saving.value = false
  }
}

async function deleteProgram(program: Program) {
  if (!confirm(`Delete ${program.displayName}?`)) return
  deletingId.value = program.id
  try {
    await $fetch(`/api/organization/programs/${program.id}`, { method: 'DELETE' })
    if (editingId.value === program.id) resetForm()
    await refresh()
    toast.add({ color: 'success', title: 'Program deleted' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not delete program', description: error.data?.statusMessage || error.message })
  } finally {
    deletingId.value = null
  }
}
</script>
