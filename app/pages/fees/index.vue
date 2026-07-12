<template>
  <div class="max-w-5xl mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Fees for {{ student?.firstName }} {{ student?.lastName }}</h1>
      <UButton color="neutral" @click="router.back()">Back</UButton>
    </div>

    <div v-if="loading" class="text-gray-500">Loading...</div>
    <div v-else-if="error" class="text-red-500">Error: {{ error }}</div>

    <div v-else>
      <!-- Assignments Section -->
      <UCard class="mb-6">
        <h2 class="text-lg font-semibold mb-3">Assignments</h2>
        <form @submit.prevent="addAssignment" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <USelect v-model="newAssignment.feePlanId" :items="feePlanOptions" placeholder="Fee Plan" required />
          <UInput v-model="newAssignment.startDate" type="date" required />
          <UInput v-model.number="newAssignment.discount" type="number" placeholder="Discount" />
          <UButton type="submit" :loading="addingAssignment">Assign</UButton>
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
                <td class="px-3 py-2">{{ ass.status }}</td>
                <td class="px-3 py-2">
                  <UButton color="error" variant="ghost" size="xs" @click="deleteAssignment(ass.id)">Delete</UButton>
                </td>
              </tr>
              <tr v-if="assignments.length === 0">
                <td colspan="8" class="px-3 py-2 text-center text-gray-500">No assignments</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Payments Section -->
      <UCard>
        <h2 class="text-lg font-semibold mb-3">Payments</h2>
        <form @submit.prevent="recordPayment" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <UInput v-model.number="paymentForm.amount" type="number" placeholder="Amount" required />
          <UInput v-model="paymentForm.paymentDate" type="date" required />
          <USelect v-model="paymentForm.method" :items="paymentMethods" placeholder="Method" required />
          <UInput v-model="paymentForm.referenceNumber" placeholder="Reference" />
          <UButton type="submit" :loading="recordingPayment">Record</UButton>
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
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useToast } from '#imports'

definePageMeta({ middleware: 'auth' })

const router = useRouter()
const route = useRoute()
const studentId = route.query.id as string

if (!studentId) {
  throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
}

const toast = useToast()
const student = ref<any>(null)
const assignments = ref<any[]>([])
const payments = ref<any[]>([])
const feePlans = ref<any[]>([])
const organization = ref<any>({})
const loading = ref(true)
const error = ref('')
const downloadingReceipt = ref(false)

// Forms (unchanged)
const newAssignment = reactive({
  feePlanId: undefined as number | undefined,
  startDate: '',
  discount: 0,
})
const addingAssignment = ref(false)

const paymentForm = reactive({
  amount: undefined as number | undefined,
  paymentDate: '',
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

const feePlanOptions = computed(() =>
  feePlans.value.map(p => ({ label: `${p.name} (${formatCurrency(p.amount)})`, value: p.id }))
)

function formatCurrency(amount: number) {
  return `₹${(amount / 100).toFixed(2)}`
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString()
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [studentData, assignmentsData, paymentsData, feePlansData, orgData] = await Promise.all([
      $fetch(`/api/students/${studentId}`),
      $fetch(`/api/students/${studentId}/fee-assignments`),
      $fetch(`/api/students/${studentId}/payments`),
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
  if (!newAssignment.feePlanId || !newAssignment.startDate) {
    toast.add({ color: 'warning', title: 'Fee plan and start date are required' })
    return
  }
  addingAssignment.value = true
  try {
    await $fetch(`/api/students/${studentId}/fee-assignments`, {
      method: 'POST' as any,
      body: {
        feePlanId: newAssignment.feePlanId,
        startDate: newAssignment.startDate,
        discount: newAssignment.discount ? Math.round(newAssignment.discount * 100) : 0,
      },
    })
    toast.add({ color: 'success', title: 'Assignment added' })
    await loadData()
    newAssignment.feePlanId = undefined
    newAssignment.startDate = ''
    newAssignment.discount = 0
  } catch (err: any) {
    toast.add({ color: 'error', title: 'Failed to add assignment', description: err.message })
  } finally {
    addingAssignment.value = false
  }
}

async function deleteAssignment(assignmentId: number) {
  if (!confirm('Delete this assignment? This cannot be undone if there are no payments.')) return
  try {
    await $fetch(`/api/students/${studentId}/fee-assignments/${assignmentId}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Assignment deleted' })
    await loadData()
  } catch (err: any) {
    toast.add({ color: 'error', title: 'Deletion failed', description: err.message })
  }
}

async function recordPayment() {
  if (!paymentForm.amount || !paymentForm.paymentDate) {
    toast.add({ color: 'warning', title: 'Amount and date are required' })
    return
  }
  recordingPayment.value = true
  try {
    await $fetch(`/api/students/${studentId}/payments`, {
      method: 'POST' as any,
      body: {
        amount: Math.round(paymentForm.amount * 100),
        paymentDate: paymentForm.paymentDate,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Payment recorded' })
    await loadData()
    paymentForm.amount = undefined
    paymentForm.paymentDate = ''
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
onMounted(loadData)
</script>