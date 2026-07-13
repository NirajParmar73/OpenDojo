<template>
  <div class="mx-auto max-w-7xl">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm font-semibold text-primary">
          FINANCE
        </p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Expenses & payables
        </h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Track operating costs and affiliation or membership fees.
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        @click="showForm = !showForm"
      >
        Record expense
      </UButton>
    </section>

    <UCard
      v-if="showForm"
      class="mt-6"
    >
      <template #header>
        <div>
          <h3 class="font-semibold">
            New expense
          </h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Amounts are recorded in your organization currency.
          </p>
        </div>
      </template>
      <form
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        @submit.prevent="createExpense"
      >
        <UFormField
          label="Category"
          required
        >
          <USelect
            v-model="form.category"
            :items="categoryOptions"
            class="w-full min-w-52"
            :ui="{ content: 'min-w-56' }"
          />
        </UFormField>
        <UFormField
          label="Description"
          required
        >
          <UInput
            v-model="form.description"
            placeholder="e.g. Annual state federation membership"
          />
        </UFormField>
        <UFormField
          label="Amount"
          required
        >
          <UInput
            v-model.number="form.amount"
            type="number"
            min="0.01"
            step="0.01"
          />
        </UFormField>
        <UFormField
          label="Scope"
          required
        >
          <USelect
            v-model="form.scopeType"
            :items="scopeOptions"
            @update:model-value="form.scopeId = null"
          />
        </UFormField>
        <UFormField
          v-if="form.scopeType !== 'organization'"
          :label="form.scopeType === 'dojo' ? 'Dojo' : 'Hierarchy node'"
          required
        >
          <USelect
            v-model="form.scopeId"
            :items="scopeItems"
            placeholder="Select scope"
          />
        </UFormField>
        <UFormField label="Due date">
          <UInput
            v-model="form.dueAt"
            type="date"
          />
        </UFormField>
        <UFormField label="Payment status">
          <USelect v-model="form.status" :items="statusOptions" />
        </UFormField>
        <UFormField v-if="form.status === 'paid'" label="Paid on">
          <UInput v-model="form.paidAt" type="date" />
        </UFormField>
        <UFormField v-if="form.status === 'paid'" label="Payment method">
          <USelect v-model="form.paymentMethod" :items="paymentMethods" />
        </UFormField>
        <UFormField label="Linked affiliation">
          <USelect
            v-model="form.affiliationId"
            :items="affiliationOptions"
            placeholder="Optional"
          />
        </UFormField>
        <UFormField label="Payee">
          <UInput
            v-model="form.payee"
            placeholder="Optional"
          />
        </UFormField>
        <UFormField label="Invoice/reference">
          <UInput
            v-model="form.invoiceNumber"
            placeholder="Optional"
          />
        </UFormField>
        <UFormField
          label="Notes"
          class="sm:col-span-2 lg:col-span-3"
        >
          <UTextarea
            v-model="form.notes"
            placeholder="Optional notes"
          />
        </UFormField>
        <div class="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showForm = false"
          >
            Cancel
          </UButton><UButton
            type="submit"
            :loading="saving"
          >
            Save expense
          </UButton>
        </div>
      </form>
    </UCard>

    <UCard class="mt-6">
      <template #header>
        <div>
          <h3 class="font-semibold">
            Expense register
          </h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Expenses due, paid, and linked to governing-body memberships.
          </p>
        </div>
      </template>
      <div
        v-if="pending"
        class="space-y-3"
      >
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-14"
        />
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        title="Could not load expenses"
        :description="error.message"
      />
      <div
        v-else-if="expenses?.length"
        class="overflow-x-auto"
      >
        <table class="min-w-full text-sm">
          <thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
            <tr>
              <th class="px-3 py-3">
                Expense
              </th><th class="px-3 py-3">
                Category
              </th><th class="px-3 py-3">
                Affiliation
              </th><th class="px-3 py-3">
                Due
              </th><th class="px-3 py-3">
                Amount
              </th><th class="px-3 py-3">
                Status
              </th>
            </tr>
          </thead><tbody>
            <tr
              v-for="expense in expenses"
              :key="expense.id"
              class="border-b border-slate-100 last:border-0 dark:border-slate-800"
            >
              <td class="px-3 py-4">
                <p class="font-medium">
                  {{ expense.description }}
                </p><p
                  v-if="expense.payee"
                  class="mt-1 text-xs text-slate-500 dark:text-slate-400"
                >
                  {{ expense.payee }}
                </p>
              </td><td class="px-3 py-4 capitalize">
                {{ expense.category.replaceAll('_', ' ') }}
              </td><td class="px-3 py-4 text-slate-600 dark:text-slate-300">
                {{ expense.affiliation?.governingBody?.name || '—' }}
              </td><td class="px-3 py-4">
                {{ formatDate(expense.dueAt) }}
              </td><td class="px-3 py-4 font-semibold">
                {{ formatCurrency(expense.amount + expense.taxAmount) }}
              </td><td class="px-3 py-4">
                <UBadge
                  :color="statusColor(expense.status)"
                  variant="subtle"
                  class="capitalize"
                >
                  {{ expense.status.replaceAll('_', ' ') }}
                </UBadge>
              </td><td class="px-3 py-4 text-right">
                <UButton size="xs" color="primary" variant="soft" @click="editExpense(expense)">Edit</UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="py-12 text-center text-sm text-slate-500 dark:text-slate-400"
      >
        No expenses recorded yet.
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type Expense = { id: number, description: string, category: string, amount: number, taxAmount: number, payee: string | null, dueAt: string | null, paidAt?: string | null, paymentMethod?: string | null, invoiceNumber?: string | null, notes?: string | null, scopeType: string, scopeId: number | null, affiliationId?: number | null, status: string, affiliation?: { governingBody?: { name: string } } }
type ScopedItem = { id: number, name: string }
const toast = useToast()
const showForm = ref(false)
const saving = ref(false)
const editingExpenseId = ref<number | null>(null)
const categoryOptions = ['rent', 'utilities', 'equipment', 'instructor_payment', 'travel', 'marketing', 'affiliation_fee', 'insurance', 'tax', 'other'].map(value => ({ label: value.replaceAll('_', ' '), value }))
const { user } = useUserSession()
const scopeOptions = computed(() => [
  ...(user.value?.role === 'owner' ? [{ label: 'Organization-wide', value: 'organization' }] : []),
  { label: 'Hierarchy node', value: 'node' },
  { label: 'Dojo', value: 'dojo' }
])
const statusOptions = [{ label: 'Due / unpaid', value: 'due' }, { label: 'Paid', value: 'paid' }]
const paymentMethods = ['cash', 'bank_transfer', 'card', 'upi', 'other'].map(value => ({ label: value.replaceAll('_', ' '), value }))
const form = reactive({ category: 'other', description: '', amount: undefined as number | undefined, scopeType: user.value?.role === 'owner' ? 'organization' : 'node', scopeId: null as number | null, dueAt: '', paidAt: '', paymentMethod: 'cash', status: 'due', affiliationId: null as number | null, payee: '', invoiceNumber: '', notes: '' })
const { data: expenses, pending, error, refresh } = await useFetch<Expense[]>('/api/finance/expenses')
const { data: affiliations } = await useFetch<Array<{ id: number, governingBody: { name: string } }>>('/api/affiliations')
const { data: reportScope } = await useFetch<{ nodes: ScopedItem[], dojos: ScopedItem[] }>('/api/reports/scope')
const scopeItems = computed(() => (form.scopeType === 'dojo' ? reportScope.value?.dojos || [] : reportScope.value?.nodes || []).map(item => ({ label: item.name, value: item.id })))
const affiliationOptions = computed(() => [{ label: 'No affiliation', value: null }, ...(affiliations.value || []).map(item => ({ label: item.governingBody.name, value: item.id }))])

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100)
}

// eslint-disable-next-line @stylistic/max-statements-per-line
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString() : '—' }
function statusColor(status: string) {
  return status === 'paid' ? 'success' : status === 'overdue' ? 'error' : status === 'cancelled' ? 'neutral' : 'warning'
}

function errorMessage(cause: unknown) {
  if (typeof cause === 'object' && cause && 'data' in cause) {
    const data = (cause as { data?: { statusMessage?: string } }).data
    if (data?.statusMessage) return data.statusMessage
  }
  return cause instanceof Error ? cause.message : 'Expense could not be saved'
}

async function createExpense() {
  if (!form.amount || form.amount <= 0 || (form.scopeType !== 'organization' && !form.scopeId)) {
    toast.add({ color: 'warning', title: 'Complete the required expense details' })
    return
  }
  saving.value = true
  try {
    const payload = { ...form, amount: Math.round(form.amount * 100), scopeId: form.scopeType === 'organization' ? null : form.scopeId, paidAt: form.status === 'paid' ? (form.paidAt || new Date().toISOString().slice(0, 10)) : null, paymentMethod: form.status === 'paid' ? form.paymentMethod : null }
    await $fetch(editingExpenseId.value ? `/api/finance/expenses/${editingExpenseId.value}` : '/api/finance/expenses', { method: editingExpenseId.value ? 'PATCH' : 'POST', body: editingExpenseId.value ? payload : { ...payload, incurredAt: new Date().toISOString().slice(0, 10) } })
    Object.assign(form, { category: 'other', description: '', amount: undefined, scopeType: user.value?.role === 'owner' ? 'organization' : 'node', scopeId: null, dueAt: '', paidAt: '', paymentMethod: 'cash', status: 'due', affiliationId: null, payee: '', invoiceNumber: '', notes: '' })
    showForm.value = false
    editingExpenseId.value = null
    await refresh()
    toast.add({ color: 'success', title: 'Expense recorded' })
  } catch (cause) {
    toast.add({ color: 'error', title: 'Could not save expense', description: errorMessage(cause) })
  } finally {
    saving.value = false
  }
}

function editExpense(expense: Expense) {
  editingExpenseId.value = expense.id
  Object.assign(form, { category: expense.category, description: expense.description, amount: expense.amount / 100, scopeType: expense.scopeType, scopeId: expense.scopeId, dueAt: expense.dueAt ? new Date(expense.dueAt).toISOString().slice(0, 10) : '', paidAt: expense.paidAt ? new Date(expense.paidAt).toISOString().slice(0, 10) : '', paymentMethod: expense.paymentMethod || 'cash', status: expense.status, affiliationId: expense.affiliationId || null, payee: expense.payee || '', invoiceNumber: expense.invoiceNumber || '', notes: expense.notes || '' })
  showForm.value = true
}
</script>
