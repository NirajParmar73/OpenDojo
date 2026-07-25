<template>
  <div>
    <h2 class="text-xl font-semibold mb-1">Fee Plans</h2>
    <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">Give each plan a distinct name. The billing interval explains how often its amount is charged.</p>

    <UCard class="mb-6">
      <form @submit.prevent="createFeePlan">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <UFormField label="Plan name" required><UInput v-model="newPlan.name" placeholder="e.g. Adult karate" required /></UFormField>
          <UFormField label="Amount per billing period" required><UInput v-model.number="newPlan.amount" type="number" placeholder="e.g. 1500" required /></UFormField>
          <UFormField label="Billing interval" required>
          <USelect
            v-model="newPlan.frequency"
            :items="frequencyOptions"
            placeholder="Frequency"
            required
          />
          </UFormField>
          <UFormField label="Applies to">
          <USelect
            v-model="newPlan.dojoId"
            :items="dojoOptions"
            :placeholder="canCreateOrganizationWide ? 'Dojo (optional: entire territory)' : 'Choose a dojo'"
            :required="!canCreateOrganizationWide"
          />
          </UFormField>
          <UFormField label="Description"><UInput v-model="newPlan.description" placeholder="Optional details" /></UFormField>
          <UButton type="submit" :loading="creating">Add Fee Plan</UButton>
        </div>
      </form>
    </UCard>

    <UCard class="mb-6">
      <template #header><div><h3 class="font-semibold">Grading fee schedule</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Set one-time grading fees per dojo and awarded belt. A fee entry is created automatically when that grading is recorded.</p></div></template>
      <form class="grid gap-4 md:grid-cols-4" @submit.prevent="createGradingFee">
        <UFormField label="Awarded belt" required><USelect v-model="gradingFee.beltRankId" :items="beltRankOptions" placeholder="Choose belt" /></UFormField>
        <UFormField label="Fee amount" required><UInput v-model.number="gradingFee.amount" type="number" min="1" placeholder="e.g. 500" /></UFormField>
        <div class="self-end"><UButton type="submit" :loading="savingGradingFee">Set selected dojos</UButton></div>
        <div class="md:col-span-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div class="mb-3 flex items-center justify-between"><p class="text-sm font-medium">Apply to dojos</p><UCheckbox :model-value="allDojosSelected" label="Select all dojos" @update:model-value="toggleAllDojos" /></div><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><UCheckbox v-for="dojo in dojos" :key="dojo.id" :model-value="gradingFee.dojoIds.includes(dojo.id)" :label="dojo.name" @update:model-value="toggleDojo(dojo.id, $event)" /></div></div>
      </form>
      <div v-if="gradingFees.length" class="mt-5 divide-y divide-slate-100 text-sm dark:divide-slate-800"><div v-for="schedule in gradingFees" :key="schedule.id" class="flex items-center justify-between gap-3 py-3"><span><strong>{{ schedule.dojo?.name }}</strong> · {{ schedule.beltRank?.name }}</span><span class="font-medium">{{ formatAmount(schedule.feePlan?.amount || 0, currency) }}</span></div></div>
    </UCard>

    <UCard>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dojo</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="plan in feePlans" :key="plan.id">
              <td class="px-4 py-4">{{ plan.name }}</td>
              <td class="px-4 py-4">{{ formatAmount(plan.amount, currency) }}</td>
              <td class="px-4 py-4">{{ frequencyLabel(plan.frequency) }}</td>
              <td class="px-4 py-4">{{ plan.dojo?.name || plan.scopeNode?.name || 'All' }}</td>
              <td class="px-4 py-4">
                <span :class="plan.isActive ? 'text-green-600' : 'text-gray-400'">
                  {{ plan.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-4 py-4">
                <UButton color="primary" variant="ghost" size="sm" @click="startEdit(plan)">Edit</UButton>
                <UButton color="error" variant="ghost" size="sm" @click="deletePlan(plan.id)">Delete</UButton>
              </td>
            </tr>
            <tr v-if="feePlans.length === 0">
              <td colspan="6" class="px-6 py-4 text-center text-gray-500">No fee plans defined.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="editingPlan" class="mt-6 border-t pt-4">
        <h3 class="text-lg font-semibold mb-3">Edit Fee Plan</h3>
        <form @submit.prevent="updatePlan">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <UFormField label="Plan name" required><UInput v-model="editForm.name" placeholder="Plan name" required /></UFormField>
            <UFormField label="Amount per billing period" required><UInput v-model.number="editForm.amount" type="number" placeholder="Amount" required /></UFormField>
            <UFormField label="Billing interval" required>
            <USelect
              v-model="editForm.frequency"
              :items="frequencyOptions"
              placeholder="Frequency"
              required
            />
            </UFormField>
            <UFormField label="Applies to">
            <USelect
              v-model="editForm.dojoId"
              :items="dojoOptions"
              :placeholder="canCreateOrganizationWide ? 'Dojo (optional: entire territory)' : 'Choose a dojo'"
              :required="!canCreateOrganizationWide"
            />
            </UFormField>
            <UFormField label="Description"><UInput v-model="editForm.description" placeholder="Description" /></UFormField>
            <div class="flex items-center gap-2">
              <UCheckbox v-model="editForm.isActive" label="Active" />
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <UButton type="submit" :loading="updating">Update</UButton>
            <UButton type="button" color="neutral" @click="cancelEdit">Cancel</UButton>
          </div>
        </form>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'fee-plan-manager'] })

const toast = useToast()
const { user } = useUserSession()
const feePlans = ref<any[]>([])
const gradingFees = ref<any[]>([])
const beltRanks = ref<any[]>([])
const dojos = ref<any[]>([])
const currency = ref('INR')
const creating = ref(false)
const updating = ref(false)
const savingGradingFee = ref(false)
const isOwner = computed(() => user.value?.role === 'owner')
const profile = ref<{ assignments: { role: string }[] } | null>(null)
const territoryManagerRoles = ['country_head', 'state_head', 'district_head', 'city_head', 'zone_head']
const canCreateOrganizationWide = computed(() => isOwner.value || !!profile.value?.assignments.some(assignment => territoryManagerRoles.includes(assignment.role)))

const frequencyOptions = [
  { label: 'Monthly - charged every month', value: 'monthly' },
  { label: 'Quarterly - charged every 3 months', value: 'quarterly' },
  { label: 'Half-annually - charged every 6 months', value: 'half-annually' },
  { label: 'Annual - charged once a year', value: 'annual' },
  { label: 'One-time - charged once', value: 'one-time' },
]

function frequencyLabel(frequency: string) {
  return frequencyOptions.find(option => option.value === frequency)?.label || frequency
}

const newPlan = reactive({
  name: '',
  amount: null as number | null,
  frequency: 'monthly',
  dojoId: null as number | null,
  description: '',
})

const editingPlan = ref<any>(null)
const editForm = reactive({
  name: '',
  amount: null as number | null,
  frequency: 'monthly',
  dojoId: null as number | null,
  description: '',
  isActive: true,
})
const gradingFee = reactive({ dojoIds: [] as number[], beltRankId: null as number | null, amount: null as number | null })
const allDojosSelected = computed(() => dojos.value.length > 0 && gradingFee.dojoIds.length === dojos.value.length)
function toggleDojo(dojoId: number, checked: boolean) { gradingFee.dojoIds = checked ? [...new Set([...gradingFee.dojoIds, dojoId])] : gradingFee.dojoIds.filter(id => id !== dojoId) }
function toggleAllDojos(checked: boolean) { gradingFee.dojoIds = checked ? dojos.value.map(dojo => dojo.id) : [] }

const dojoOptions = computed(() =>
  dojos.value.map(d => ({ label: d.name, value: d.id }))
)
const beltRankOptions = computed(() => beltRanks.value.map(rank => ({ label: rank.name, value: rank.id })))

function formatAmount(amount: number, cur: string) {
  const symbol = cur === 'INR' ? '₹' : cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur
  return `${symbol}${(amount / 100).toFixed(2)}`
}

async function loadData() {
  try {
    const [plans, dojosData, org, userProfile, schedules, ranks] = await Promise.all([
      $fetch('/api/fee-plans'),
      $fetch('/api/dojos'),
      $fetch('/api/organization/settings'),
      $fetch<{ assignments: { role: string }[] }>('/api/user/profile'),
      $fetch('/api/grading-fee-schedules'),
      $fetch('/api/belt-ranks'),
    ])
    feePlans.value = plans
    dojos.value = dojosData
    currency.value = org.currency || 'INR'
    profile.value = userProfile
    gradingFees.value = schedules as any[]
    beltRanks.value = ranks as any[]
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load data', description: error.message })
  }
}

async function createGradingFee() {
  if (!gradingFee.dojoIds.length || !gradingFee.beltRankId || !gradingFee.amount) { toast.add({ color: 'warning', title: 'Choose at least one dojo, a belt, and an amount' }); return }
  savingGradingFee.value = true
  try { await $fetch('/api/grading-fee-schedules', { method: 'POST', body: { dojoIds: gradingFee.dojoIds, beltRankId: gradingFee.beltRankId, amount: Math.round(gradingFee.amount * 100) } }); Object.assign(gradingFee, { dojoIds: [], beltRankId: null, amount: null }); await loadData(); toast.add({ color: 'success', title: 'Grading fee added to selected dojos' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not add grading fee', description: error.data?.statusMessage || error.message }) } finally { savingGradingFee.value = false }
}

async function createFeePlan() {
  if (!newPlan.name || !newPlan.amount || (!canCreateOrganizationWide.value && !newPlan.dojoId)) {
    toast.add({ color: 'warning', title: canCreateOrganizationWide.value ? 'Name and amount are required' : 'Name, amount, and dojo are required' })
    return
  }
  creating.value = true
  try {
    const amountMinor = Math.round(newPlan.amount * 100)
    await $fetch('/api/fee-plans', {
      method: 'POST',
      body: {
        name: newPlan.name,
        amount: amountMinor,
        frequency: newPlan.frequency,
        dojoId: newPlan.dojoId || undefined,
        description: newPlan.description || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Fee plan created' })
    Object.assign(newPlan, { name: '', amount: null, frequency: 'monthly', dojoId: null, description: '' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Creation failed', description: error.message })
  } finally {
    creating.value = false
  }
}

function startEdit(plan: any) {
  editingPlan.value = plan
  editForm.name = plan.name
  editForm.amount = plan.amount / 100
  editForm.frequency = plan.frequency
  editForm.dojoId = plan.dojoId
  editForm.description = plan.description || ''
  editForm.isActive = !!plan.isActive
}

function cancelEdit() {
  editingPlan.value = null
}

async function updatePlan() {
  if (!editingPlan.value) return
  if (!editForm.name || !editForm.amount || (!canCreateOrganizationWide.value && !editForm.dojoId)) {
    toast.add({ color: 'warning', title: canCreateOrganizationWide.value ? 'Name and amount are required' : 'Name, amount, and dojo are required' })
    return
  }
  updating.value = true
  try {
    const amountMinor = Math.round(editForm.amount * 100)
    await $fetch(`/api/fee-plans/${editingPlan.value.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        amount: amountMinor,
        frequency: editForm.frequency,
        dojoId: editForm.dojoId || null,
        description: editForm.description || null,
        isActive: editForm.isActive,
      },
    })
    toast.add({ color: 'success', title: 'Fee plan updated' })
    cancelEdit()
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Update failed', description: error.message })
  } finally {
    updating.value = false
  }
}

async function deletePlan(id: number) {
  if (!confirm('Delete this fee plan?')) return
  try {
    await $fetch(`/api/fee-plans/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Fee plan deleted' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Deletion failed', description: error.message })
  }
}

onMounted(loadData)
</script>
