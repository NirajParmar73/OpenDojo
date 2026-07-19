<template>
  <div class="max-w-5xl mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <div><p class="text-sm font-semibold text-primary">FINANCE</p><h1 class="mt-1 text-2xl font-semibold tracking-tight">{{ student ? `Fees for ${student.firstName} ${student.lastName}` : 'Record a payment' }}</h1></div>
      <UButton v-if="studentId" color="neutral" variant="ghost" icon="i-lucide-arrow-left" to="/students">Students</UButton>
    </div>

    <UCard v-if="!studentId" class="mx-auto max-w-3xl">
      <template #header><div><h2 class="font-semibold">Choose a student</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">First choose an area and dojo, then select the student. You will only see locations you are allowed to manage.</p></div></template>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><UFormField label="Area"><USelect v-model="selectedHierarchyId" :items="hierarchyOptions" /></UFormField><UFormField label="Dojo"><USelect v-model="selectedDojoId" :items="dojoOptions" /></UFormField><UFormField label="Student"><USelect v-model="selectedStudentId" :items="studentOptions" placeholder="Select a student" /></UFormField></div>
      <div class="mt-5 flex justify-end"><UButton color="primary" icon="i-lucide-arrow-right" :disabled="!selectedStudentId" @click="openStudentFees">Continue</UButton></div>
      <p v-if="!studentOptions.length" class="mt-4 text-sm text-slate-500 dark:text-slate-400">No students are available yet. Add a student first.</p>
    </UCard>

    <template v-else>
    <div v-if="loading" class="text-gray-500">Loading fee details...</div>
    <div v-else-if="error" class="text-red-500">Error: {{ error }}</div>

    <div v-else>
      <UCard class="mb-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 class="text-lg font-semibold">Shareable fee statement</h2><p class="mt-1 text-sm text-slate-500">Download a payment statement for a selected period to share with the student.</p></div>
          <div class="grid gap-3 sm:grid-cols-3"><UFormField label="Statement from"><UInput v-model="reportFrom" type="date" /></UFormField><UFormField label="Statement to"><UInput v-model="reportTo" type="date" /></UFormField><div class="self-end"><UButton color="primary" icon="i-lucide-eye" :loading="downloadingReport" @click="downloadFeeReport">Preview PDF</UButton></div></div>
        </div>
      </UCard>
      <UCard class="mb-6">
        <div class="mb-4"><h2 class="text-lg font-semibold">Fee plans for this student</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Assign the monthly, quarterly, annual, or one-time plan that applies to this student. End an active plan before starting a replacement so their payment history remains clear.</p></div>
        <form @submit.prevent="addAssignment" class="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UFormField label="Fee plan" required><USelect v-model="newAssignment.feePlanId" :items="feePlanOptions" placeholder="Choose a fee plan" required /></UFormField>
          <UFormField label="Plan starts on" required><UInput v-model="newAssignment.startDate" type="date" required /></UFormField>
          <UFormField label="Due day"><UInput v-model.number="newAssignment.dueDay" type="number" min="1" max="28" required /></UFormField>
          <UFormField label="Discount"><UInput v-model.number="newAssignment.discount" type="number" min="0" step="0.01" placeholder="0.00" /></UFormField>
          <UFormField v-if="newAssignment.discount" label="Discount reason" required><UInput v-model="newAssignment.discountReason" placeholder="Reason for discount" required /></UFormField>
          <div class="self-end"><UButton type="submit" class="w-full" :loading="addingAssignment">Assign plan</UButton></div>
        </form>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left">Plan</th>
                <th class="px-3 py-2 text-left">Start</th>
                <th class="px-3 py-2 text-left">Amount</th>
                <th class="px-3 py-2 text-left">Discount</th>
                <th class="px-3 py-2 text-left">Net</th>
                <th class="px-3 py-2 text-left">Outstanding</th>
                <th class="px-3 py-2 text-left">Due day</th>
                <th class="px-3 py-2 text-left">Status</th>
                <th class="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ass in assignments" :key="ass.id">
                <td class="px-3 py-2">{{ ass.feePlan?.name }}</td>
                <td class="px-3 py-2">{{ formatDate(ass.startDate) }}</td>
                <td class="px-3 py-2">{{ formatCurrency(ass.feePlan?.amount || 0) }}</td>
                <td class="px-3 py-2">{{ formatCurrency(ass.discount || 0) }}</td>
                <td class="px-3 py-2">{{ formatCurrency(ass.netAmount || 0) }}</td>
                <td class="px-3 py-2">{{ formatCurrency(ass.outstanding || 0) }}</td>
                <td class="px-3 py-2">{{ ass.dueDay }}{{ ordinal(ass.dueDay) }}</td>
                <td class="px-3 py-2"><UBadge :color="ass.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="capitalize">{{ ass.status }}</UBadge></td>
                <td class="px-3 py-2">
                  <UButton v-if="ass.status === 'active'" color="warning" variant="ghost" size="xs" @click="endAssignment(ass.id)">End plan</UButton>
                </td>
              </tr>
              <tr v-if="assignments.length === 0">
                <td colspan="9" class="px-3 py-2 text-center text-gray-500">No fee plan assigned yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Payments Section -->
      <UCard>
        <div class="mb-3"><h2 class="text-lg font-semibold">Record payment</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter the amount received and how it was paid. A receipt is created automatically.</p></div>
        <form @submit.prevent="recordPayment" class="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UFormField label="Payment for" required><USelect v-model="paymentForm.assignmentId" :items="assignmentOptions" placeholder="Choose a fee plan" required /></UFormField>
          <UFormField label="Amount received" required><UInput v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></UFormField>
          <UFormField label="Payment received on" required><UInput v-model="paymentForm.paymentDate" type="date" required /></UFormField>
          <UFormField label="Fee period begins" required help="The coverage range is calculated from the selected fee plan."><UInput v-model="paymentForm.billingPeriod" type="month" required /></UFormField>
          <p v-if="selectedAssignment" class="text-sm text-slate-500 dark:text-slate-400 sm:col-span-2 xl:col-span-4">Coverage: <span class="font-medium text-slate-700 dark:text-slate-200">{{ paymentCoverage }}</span></p>
          <UFormField label="Payment method" required><USelect v-model="paymentForm.method" :items="paymentMethods" class="min-w-40" :ui="{ content: 'min-w-40' }" required /></UFormField>
          <UFormField label="Reference"><UInput v-model="paymentForm.referenceNumber" placeholder="Optional reference" /></UFormField>
          <div class="self-end xl:col-span-2"><UButton type="submit" class="w-full" :loading="recordingPayment">Save payment</UButton></div>
        </form>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left">Receipt</th>
                <th class="px-3 py-2 text-left">Date</th>
                <th class="px-3 py-2 text-left">Amount</th>
                <th class="px-3 py-2 text-left">Method</th>
                <th class="px-3 py-2 text-left">Reference</th>
                <th class="px-3 py-2 text-left">Receipt</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pay in payments" :key="pay.id">
                <td class="px-3 py-2">{{ pay.receiptNumber }}</td>
                <td class="px-3 py-2">{{ formatDate(pay.paymentDate) }}</td>
                <td class="px-3 py-2">{{ formatCurrency(pay.amount) }}</td>
                <td class="px-3 py-2">{{ pay.method }}</td>
                <td class="px-3 py-2">{{ pay.referenceNumber || '-' }}</td>
                <td class="px-3 py-2">
                  <UButton
                    color="primary"
                    variant="ghost"
                    size="xs"
                    @click="downloadReceipt(pay)"
                    :loading="downloadingReceipt"
                    :disabled="downloadingReceipt"
                  >
                    Receipt
                  </UButton>
                </td>
              </tr>
              <tr v-if="payments.length === 0">
                <td colspan="6" class="px-3 py-2 text-center text-gray-500">No payments</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useToast } from '#imports'

definePageMeta({ middleware: 'auth' })

const router = useRouter()
const route = useRoute()
const studentId = ref(typeof route.query.id === 'string' ? route.query.id : '')
const selectedStudentId = ref<number | undefined>()
const selectedHierarchyId = ref<number | 'all'>('all')
const selectedDojoId = ref<number | 'all'>('all')
const { data: studentDirectory } = await useFetch<any[]>('/api/students')

const toast = useToast()
const student = ref<any>(null)
const assignments = ref<any[]>([])
const payments = ref<any[]>([])
const feePlans = ref<any[]>([])
const organization = ref<any>({})
const loading = ref(true)
const error = ref('')
const downloadingReceipt = ref(false)
const downloadingReport = ref(false)
const reportFrom = ref('')
const reportTo = ref('')
const today = new Date().toISOString().slice(0, 10)
const currentMonth = today.slice(0, 7)

const newAssignment = reactive({
  feePlanId: undefined as number | undefined,
  startDate: today,
  dueDay: new Date().getDate() > 28 ? 28 : new Date().getDate(),
  discount: 0,
  discountReason: '',
})
const addingAssignment = ref(false)

const paymentForm = reactive({
  assignmentId: undefined as number | undefined,
  amount: undefined as number | undefined,
  paymentDate: today,
  billingPeriod: currentMonth,
  method: 'cash',
  referenceNumber: '',
})
const recordingPayment = ref(false)

const paymentMethods = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Card', value: 'card' },
  { label: 'Other', value: 'other' },
]

const hierarchyOptions = computed(() => {
  const areas = new Map<number, string>()
  for (const student of studentDirectory.value || []) {
    if (student.dojo?.node?.id) areas.set(student.dojo.node.id, student.dojo.node.name)
  }
  return [{ label: 'All accessible areas', value: 'all' }, ...[...areas].map(([id, name]) => ({ label: name, value: id }))]
})
const dojoOptions = computed(() => {
  const dojos = new Map<number, string>()
  for (const student of studentDirectory.value || []) {
    if (student.dojo && (selectedHierarchyId.value === 'all' || student.dojo.nodeId === selectedHierarchyId.value)) dojos.set(student.dojo.id, student.dojo.name)
  }
  return [{ label: 'All accessible dojos', value: 'all' }, ...[...dojos].map(([id, name]) => ({ label: name, value: id }))]
})
const filteredStudents = computed(() => (studentDirectory.value || []).filter(student =>
  (selectedHierarchyId.value === 'all' || student.dojo?.nodeId === selectedHierarchyId.value)
  && (selectedDojoId.value === 'all' || student.dojoId === selectedDojoId.value)
))
const studentOptions = computed(() => filteredStudents.value.map(student => ({
  label: `${student.firstName} ${student.lastName}${student.dojo?.name ? ` · ${student.dojo.name}` : ''}`,
  value: student.id,
})))

watch(selectedHierarchyId, () => { selectedDojoId.value = 'all'; selectedStudentId.value = undefined })
watch(selectedDojoId, () => { selectedStudentId.value = undefined })

const feePlanOptions = computed(() =>
  feePlans.value
    .filter(plan => !plan.dojoId || plan.dojoId === student.value?.dojoId)
    .filter(plan => !!plan.isActive)
    .map(plan => ({ label: `${plan.name} · ${plan.frequency} (${formatCurrency(plan.amount)})`, value: plan.id }))
)
const assignmentOptions = computed(() =>
  assignments.value
    .filter(assignment => assignment.status === 'active')
    .map(assignment => ({
      label: `${assignment.feePlan?.name || 'Fee plan'} · ${formatCurrency(assignment.outstanding || 0)} due`,
      value: assignment.id,
    }))
)
const selectedAssignment = computed(() => assignments.value.find(assignment => assignment.id === paymentForm.assignmentId))
const paymentCoverage = computed(() => selectedAssignment.value ? formatFeePeriod(paymentForm.billingPeriod, selectedAssignment.value.feePlan?.frequency) : '')

function formatCurrency(amount: number) {
  return `₹${(amount / 100).toFixed(2)}`
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString()
}

function ordinal(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th'
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] || 'th'
}

function formatFeePeriod(startMonth: string, frequency?: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) return 'Choose a valid start month'
  const year = Number(startMonth.slice(0, 4))
  const month = Number(startMonth.slice(5, 7))
  const start = new Date(year, month - 1, 1)
  const monthLabel = (date: Date) => date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  if (frequency === 'one-time') return `One-time charge in ${monthLabel(start)}`
  const months = frequency === 'quarterly' ? 3 : frequency === 'annual' ? 12 : 1
  if (months === 1) return monthLabel(start)
  const end = new Date(year, month + months - 2, 1)
  return `${monthLabel(start)} – ${monthLabel(end)}`
}

async function loadData() {
  if (!studentId.value) return
  loading.value = true
  error.value = ''
  try {
    const [studentData, assignmentsData, paymentsData, feePlansData, orgData] = await Promise.all([
      $fetch(`/api/students/${studentId.value}`),
      $fetch(`/api/students/${studentId.value}/fee-assignments`),
      $fetch(`/api/students/${studentId.value}/payments`),
      $fetch('/api/fee-plans'),
      $fetch('/api/organization/settings'),
    ])
    student.value = studentData
    assignments.value = assignmentsData
    payments.value = paymentsData
    feePlans.value = feePlansData
    organization.value = orgData
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || 'Failed to load data'
    toast.add({ color: 'error', title: 'Failed to load data', description: error.value })
  } finally {
    loading.value = false
  }
}

async function addAssignment() {
  if (!newAssignment.feePlanId || !newAssignment.startDate || !newAssignment.dueDay || (newAssignment.discount && !newAssignment.discountReason.trim())) {
    toast.add({ color: 'warning', title: 'Choose a plan, start date, due day, and a reason for any discount' })
    return
  }
  addingAssignment.value = true
  try {
    await $fetch(`/api/students/${studentId.value}/fee-assignments`, {
      method: 'POST' as any,
      body: {
        feePlanId: newAssignment.feePlanId,
        startDate: newAssignment.startDate,
        dueDay: newAssignment.dueDay,
        discount: newAssignment.discount ? Math.round(newAssignment.discount * 100) : 0,
        discountReason: newAssignment.discountReason.trim() || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Assignment added' })
    await loadData()
    newAssignment.feePlanId = undefined
    newAssignment.startDate = today
    newAssignment.dueDay = new Date().getDate() > 28 ? 28 : new Date().getDate()
    newAssignment.discount = 0
    newAssignment.discountReason = ''
  } catch (err: any) {
    toast.add({ color: 'error', title: 'Failed to add assignment', description: err.message })
  } finally {
    addingAssignment.value = false
  }
}

function openStudentFees() {
  if (!selectedStudentId.value) return
  router.push({ path: '/fees', query: { id: String(selectedStudentId.value) } })
}

async function endAssignment(assignmentId: number) {
  if (!confirm('End this fee plan today? Its payment history will be kept.')) return
  try {
    await $fetch(`/api/students/${studentId.value}/fee-assignments/${assignmentId}`, { method: 'PATCH', body: { status: 'expired', endDate: today } })
    toast.add({ color: 'success', title: 'Fee plan ended' })
    await loadData()
  } catch (err: any) {
    toast.add({ color: 'error', title: 'Deletion failed', description: err.message })
  }
}

async function recordPayment() {
  if (!paymentForm.assignmentId || !paymentForm.amount || !paymentForm.paymentDate || !paymentForm.billingPeriod) {
    toast.add({ color: 'warning', title: 'Fee assignment, amount, payment date, and fee-period start are required' })
    return
  }
  recordingPayment.value = true
  try {
    await $fetch(`/api/students/${studentId.value}/payments`, {
      method: 'POST' as any,
      body: {
        amount: Math.round(paymentForm.amount * 100),
        assignmentId: paymentForm.assignmentId,
        paymentDate: paymentForm.paymentDate,
        billingPeriod: paymentForm.billingPeriod,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Payment recorded' })
    await loadData()
    paymentForm.assignmentId = undefined
    paymentForm.amount = undefined
    paymentForm.paymentDate = today
    paymentForm.billingPeriod = currentMonth
    paymentForm.method = 'cash'
    paymentForm.referenceNumber = ''
  } catch (err: any) {
    toast.add({ color: 'error', title: 'Payment failed', description: err.message })
  } finally {
    recordingPayment.value = false
  }
}

// ---- Receipt download ----
async function downloadReceipt(payment: any) {
  if (downloadingReceipt.value) return
  downloadingReceipt.value = true

  try {
    const response = await fetch(`/api/payments/${payment.id}/receipt`)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'Failed to generate receipt')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt_${payment.receiptNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    toast.add({ color: 'success', title: 'Receipt downloaded' })
  } catch (err: any) {
    console.error('Receipt error:', err)
    toast.add({ color: 'error', title: 'Receipt download failed', description: err.message || 'Unknown error' })
  } finally {
    downloadingReceipt.value = false
  }
}

async function downloadFeeReport() {
  if (downloadingReport.value) return
  const preview = window.open('', '_blank')
  downloadingReport.value = true
  try {
    const params = new URLSearchParams()
    if (reportFrom.value) params.set('from', reportFrom.value)
    if (reportTo.value) params.set('to', reportTo.value)
    const response = await fetch(`/api/students/${studentId.value}/fee-report?${params.toString()}`)
    if (!response.ok) throw new Error((await response.text()) || 'Failed to generate fee statement')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    if (preview) preview.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    toast.add({ color: 'success', title: 'Fee statement ready to preview' })
  } catch (error: any) {
    preview?.close()
    toast.add({ color: 'error', title: 'Could not download fee statement', description: error.message })
  } finally {
    downloadingReport.value = false
  }
}
watch(() => route.query.id, async id => {
  studentId.value = typeof id === 'string' ? id : ''
  student.value = null
  assignments.value = []
  payments.value = []
  if (studentId.value) await loadData()
})

onMounted(() => { if (studentId.value) loadData() })
</script>
