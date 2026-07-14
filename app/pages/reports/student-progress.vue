<template>
  <div class="mx-auto max-w-3xl">
    <section class="mb-6">
      <p class="text-sm font-semibold text-primary">INSIGHTS</p>
      <h2 class="mt-1 text-2xl font-semibold">Student progress report</h2>
      <p class="mt-2 text-sm text-slate-500">Choose a student within your permitted hierarchy to download a shareable progress report.</p>
    </section>

    <UCard>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Hierarchy territory">
          <USelect v-model="selectedNodeId" :items="nodeOptions" placeholder="All accessible hierarchy" />
        </UFormField>
        <UFormField label="Dojo">
          <USelect v-model="selectedDojoId" :items="dojoOptions" placeholder="All accessible dojos" />
        </UFormField>
        <UFormField label="Student" class="sm:col-span-2">
          <USelect v-model="studentId" :items="studentOptions" placeholder="Select a student" searchable />
        </UFormField>
      </div>
      <div class="mt-5 flex justify-end">
        <UButton :disabled="!studentId" icon="i-lucide-eye" @click="download">Preview report</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type ScopeNode = { id: number, name: string, parentId: number | null }
type ScopeDojo = { id: number, name: string, nodeId: number }

const toast = useToast()
const studentId = ref<number | null>(null)
const selectedNodeId = ref<number | null>(null)
const selectedDojoId = ref<number | null>(null)
const { data: students } = await useFetch<any[]>('/api/students')
const { data: scope } = await useFetch<{ nodes: ScopeNode[], dojos: ScopeDojo[] }>('/api/reports/scope')

const nodeOptions = computed(() => [
  { label: 'All accessible hierarchy', value: null },
  ...((scope.value?.nodes || []).map(node => ({ label: node.name, value: node.id })))
])

const selectedNodeAndDescendants = computed(() => {
  if (!selectedNodeId.value) return null
  const nodeIds = new Set<number>([selectedNodeId.value])
  let changed = true
  while (changed) {
    changed = false
    for (const node of scope.value?.nodes || []) {
      if (node.parentId !== null && nodeIds.has(node.parentId) && !nodeIds.has(node.id)) {
        nodeIds.add(node.id)
        changed = true
      }
    }
  }
  return nodeIds
})

const filteredDojos = computed(() => (scope.value?.dojos || []).filter(dojo => !selectedNodeAndDescendants.value || selectedNodeAndDescendants.value.has(dojo.nodeId)))
const dojoOptions = computed(() => [
  { label: 'All accessible dojos', value: null },
  ...filteredDojos.value.map(dojo => ({ label: dojo.name, value: dojo.id }))
])
const filteredStudents = computed(() => (students.value || []).filter(student => !selectedDojoId.value || student.dojoId === selectedDojoId.value).filter(student => filteredDojos.value.some(dojo => dojo.id === student.dojoId)))
const studentOptions = computed(() => filteredStudents.value.map(student => ({ label: `${student.firstName} ${student.lastName}${student.dojo?.name ? ` — ${student.dojo.name}` : ''}`, value: student.id })))

watch(selectedNodeId, () => {
  selectedDojoId.value = null
  studentId.value = null
})
watch(selectedDojoId, () => { studentId.value = null })

async function download() {
  if (!studentId.value) return
  const preview = window.open('', '_blank')
  try {
    const response = await fetch(`/api/students/${studentId.value}/progress-report`)
    if (!response.ok) throw new Error('Could not generate progress report')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    if (preview) preview.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error: any) {
    preview?.close()
    toast.add({ color: 'error', title: 'Could not download report', description: error.message })
  }
}
</script>
