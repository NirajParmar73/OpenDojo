<template>
  <div class="max-w-3xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Attendance Report</h1>

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
          <UFormGroup label="From">
            <UInput v-model="dateFrom" type="date" />
          </UFormGroup>
          <UFormGroup label="To">
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

onMounted(loadStudents)
</script>