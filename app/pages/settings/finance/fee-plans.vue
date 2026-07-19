<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">Fee Plans</h2>

    <UCard class="mb-6">
      <form @submit.prevent="createFeePlan">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <UInput v-model="newPlan.name" placeholder="Plan name" required />
          <UInput v-model.number="newPlan.amount" type="number" placeholder="Amount" required />
          <USelect
            v-model="newPlan.frequency"
            :items="frequencyOptions"
            placeholder="Frequency"
            required
          />
          <USelect
            v-model="newPlan.dojoId"
            :items="dojoOptions"
            :placeholder="isOwner ? 'Dojo (optional)' : 'Choose a dojo'"
            :required="!isOwner"
          />
          <UInput v-model="newPlan.description" placeholder="Description (optional)" />
          <UButton type="submit" :loading="creating">Add Fee Plan</UButton>
        </div>
      </form>
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
              <td class="px-4 py-4">{{ plan.frequency }}</td>
              <td class="px-4 py-4">{{ plan.dojo?.name || 'All' }}</td>
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
            <UInput v-model="editForm.name" placeholder="Plan name" required />
            <UInput v-model.number="editForm.amount" type="number" placeholder="Amount" required />
            <USelect
              v-model="editForm.frequency"
              :items="frequencyOptions"
              placeholder="Frequency"
              required
            />
            <USelect
              v-model="editForm.dojoId"
              :items="dojoOptions"
              :placeholder="isOwner ? 'Dojo (optional)' : 'Choose a dojo'"
              :required="!isOwner"
            />
            <UInput v-model="editForm.description" placeholder="Description" />
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
const dojos = ref<any[]>([])
const currency = ref('INR')
const creating = ref(false)
const updating = ref(false)
const isOwner = computed(() => user.value?.role === 'owner')

const frequencyOptions = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annual', value: 'annual' },
  { label: 'One-time', value: 'one-time' },
]

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

const dojoOptions = computed(() =>
  dojos.value.map(d => ({ label: d.name, value: d.id }))
)

function formatAmount(amount: number, cur: string) {
  const symbol = cur === 'INR' ? '₹' : cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur
  return `${symbol}${(amount / 100).toFixed(2)}`
}

async function loadData() {
  try {
    const [plans, dojosData, org] = await Promise.all([
      $fetch('/api/fee-plans'),
      $fetch('/api/dojos'),
      $fetch('/api/organization/settings'),
    ])
    feePlans.value = plans
    dojos.value = dojosData
    currency.value = org.currency || 'INR'
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load data', description: error.message })
  }
}

async function createFeePlan() {
  if (!newPlan.name || !newPlan.amount || (!isOwner.value && !newPlan.dojoId)) {
    toast.add({ color: 'warning', title: isOwner.value ? 'Name and amount are required' : 'Name, amount, and dojo are required' })
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
  if (!editForm.name || !editForm.amount || (!isOwner.value && !editForm.dojoId)) {
    toast.add({ color: 'warning', title: isOwner.value ? 'Name and amount are required' : 'Name, amount, and dojo are required' })
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
