<template>
  <div class="mx-auto max-w-4xl">
    <section class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm font-semibold text-primary">INSIGHTS</p><h2 class="mt-1 text-2xl font-semibold">Attendance report</h2><p class="mt-2 text-sm text-slate-500">Review attendance for an accessible hierarchy entity or dojo.</p></div><UButton icon="i-lucide-download" variant="soft" :disabled="!summary" @click="downloadSummaryCsv">Export CSV</UButton></section>

    <UCard class="mb-6">
      <h2 class="text-lg font-semibold mb-1">Territory summary</h2><p class="mb-4 text-sm text-slate-500">Only hierarchy entities and dojos assigned to you can be selected.</p>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3"><USelect v-model="scopeType" :items="scopeTypes" /><USelect v-model="selectedScopeId" :items="scopeOptions" placeholder="All accessible entities" /><UButton :loading="loadingSummary" @click="loadSummary">View summary</UButton></div>
      <div v-if="summary" class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5"><div v-for="item in summaryItems" :key="item.label" class="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800"><p class="text-xs text-slate-500">{{ item.label }}</p><p class="mt-1 text-xl font-semibold">{{ item.value }}</p></div></div>
    </UCard>

    <UCard>
      <form @submit.prevent="generateReport">
        <UFormGroup label="Student" class="mb-4">
          <USelect
            v-model="selectedStudentId"
            :items="studentOptions"
            placeholder="Select a student"
            required
          />
        </UFormGroup>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <UFormGroup label="Attendance from">
            <UInput v-model="dateFrom" type="date" />
          </UFormGroup>
          <UFormGroup label="Attendance to">
            <UInput v-model="dateTo" type="date" />
          </UFormGroup>
        </div>

        <UButton type="submit" :loading="generating" color="primary">
          Generate & Download PDF
        </UButton>
      </form>
    </UCard>

    <div v-if="downloadUrl" class="mt-4 p-4 bg-green-50 border border-green-200 rounded">
      <p class="text-green-700">✅ Report ready! Click the button below to download.</p>
      <UButton color="primary" @click="downloadReport" class="mt-2">
        Download PDF
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const students = ref<any[]>([])
const selectedStudentId = ref<number | null>(null)
const dateFrom = ref('')
const dateTo = ref('')
const generating = ref(false)
const downloadUrl = ref('')
const scopeType = ref('dojo')
const selectedScopeId = ref<number | null>(null)
const reportScope = ref<{ nodes: Array<{ id: number, name: string }>, dojos: Array<{ id: number, name: string }> }>({ nodes: [], dojos: [] })
const summary = ref<any>(null)
const loadingSummary = ref(false)
const scopeTypes = [{ label: 'Dojo', value: 'dojo' }, { label: 'Hierarchy entity', value: 'node' }]
const scopeOptions = computed(() => (scopeType.value === 'dojo' ? reportScope.value.dojos : reportScope.value.nodes).map(item => ({ label: item.name, value: item.id })))
const summaryItems = computed(() => summary.value ? [{ label: 'Attendance', value: `${summary.value.attendanceRate}%` }, { label: 'Present', value: summary.value.present }, { label: 'Late', value: summary.value.late }, { label: 'Absent', value: summary.value.absent }, { label: 'Records', value: summary.value.total }] : [])

const studentOptions = computed(() =>
  students.value.map((s: any) => ({
    label: `${s.firstName} ${s.lastName}`,
    value: s.id,
  }))
)

async function loadStudents() {
  try {
    const res = await fetch('/api/students')
    if (!res.ok) throw new Error('Failed to load students')
    students.value = await res.json()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load students', description: error.message })
  }
}

async function loadSummary() {
  loadingSummary.value = true
  try {
    const params = new URLSearchParams()
    if (selectedScopeId.value) params.set(scopeType.value === 'dojo' ? 'dojoId' : 'nodeId', String(selectedScopeId.value))
    if (dateFrom.value) params.set('from', dateFrom.value)
    if (dateTo.value) params.set('to', dateTo.value)
    summary.value = await $fetch(`/api/reports/attendance/summary?${params}`)
  } catch (error: any) { toast.add({ color: 'error', title: 'Could not load summary', description: error.data?.statusMessage || error.message }) } finally { loadingSummary.value = false }
}

function downloadSummaryCsv() {
  if (!summary.value) return
  const scope = selectedScopeId.value ? scopeOptions.value.find(item => item.value === selectedScopeId.value)?.label || 'Selected scope' : 'All accessible entities'
  const rows = [['Attendance summary', scope], ['Metric', 'Value'], ['Attendance rate', `${summary.value.attendanceRate}%`], ['Present', summary.value.present], ['Late', summary.value.late], ['Absent', summary.value.absent], ['Excused', summary.value.excused], ['Records', summary.value.total]]
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'attendance-summary.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function generateReport() {
  if (!selectedStudentId.value) {
    toast.add({ color: 'warning', title: 'Please select a student' })
    return
  }

  generating.value = true
  downloadUrl.value = ''
  try {
    const params = new URLSearchParams()
    if (dateFrom.value) params.append('from', dateFrom.value)
    if (dateTo.value) params.append('to', dateTo.value)

    const url = `/api/reports/attendance/student/${selectedStudentId.value}?${params.toString()}`
    const response = await fetch(url)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'Failed to generate report')
    }
    const blob = await response.blob()
    downloadUrl.value = URL.createObjectURL(blob)
    toast.add({ color: 'success', title: 'Report ready to download' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Generation failed', description: error.message })
  } finally {
    generating.value = false
  }
}

function downloadReport() {
  if (downloadUrl.value) {
    const a = document.createElement('a')
    a.href = downloadUrl.value
    const student = students.value.find((s: any) => s.id === selectedStudentId.value)
    const name = student ? `${student.firstName}_${student.lastName}` : 'report'
    a.download = `attendance_${name}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl.value)
      downloadUrl.value = ''
    }, 5000)
  }
}

onMounted(async () => { await Promise.all([loadStudents(), $fetch('/api/reports/scope').then(data => { reportScope.value = data })]); await loadSummary() })
</script>
