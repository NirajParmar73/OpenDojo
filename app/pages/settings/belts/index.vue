<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">Belt System</h2>

    <!-- Create Rank Form -->
    <UCard class="mb-6">
      <form @submit.prevent="createRank">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <UInput v-model="newRank.name" placeholder="Rank name (e.g., White Belt)" required />
          <UInput v-model="newRank.level" placeholder="Level (e.g., 9th Kyu)" required />
          <UInput v-model.number="newRank.order" type="number" placeholder="Order (1,2,3...)" required />
          <USelect
            v-model="newRank.type"
            :items="typeOptions"
            placeholder="Type"
            required
          />
          <UInput v-model.number="newRank.danNumber" type="number" placeholder="Dan number (if dan)" />
          <UInput v-model="newRank.color" placeholder="Color (e.g., #FFFFFF)" />
          <UInput v-model="newRank.description" placeholder="Description (optional)" />
        </div>
        <UButton type="submit" class="mt-4" :loading="creating">Add Rank</UButton>
      </form>
    </UCard>

    <!-- Rank List -->
    <UCard>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dan</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="rank in ranks" :key="rank.id">
              <td class="px-4 py-4">{{ rank.order }}</td>
              <td class="px-4 py-4">{{ rank.name }}</td>
              <td class="px-4 py-4">{{ rank.level }}</td>
              <td class="px-4 py-4">{{ rank.type }}</td>
              <td class="px-4 py-4">{{ rank.danNumber || '-' }}</td>
              <td class="px-4 py-4">
                <span v-if="rank.color" class="inline-block w-6 h-6 rounded-full" :style="{ backgroundColor: rank.color }"></span>
                <span v-else>-</span>
              </td>
              <td class="px-4 py-4">
                <UButton color="primary" variant="ghost" size="sm" @click="startEdit(rank)">Edit</UButton>
                <UButton color="error" variant="ghost" size="sm" @click="deleteRank(rank.id)">Delete</UButton>
              </td>
            </tr>
            <tr v-if="ranks.length === 0">
              <td colspan="7" class="px-6 py-4 text-center text-gray-500">No belt ranks defined yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingRank" class="mt-6 border-t pt-4">
        <h3 class="text-lg font-semibold mb-3">Edit Rank</h3>
        <form @submit.prevent="updateRank">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <UInput v-model="editForm.name" placeholder="Rank name" required />
            <UInput v-model="editForm.level" placeholder="Level" required />
            <UInput v-model.number="editForm.order" type="number" placeholder="Order" required />
            <USelect
              v-model="editForm.type"
              :items="typeOptions"
              placeholder="Type"
              required
            />
            <UInput v-model.number="editForm.danNumber" type="number" placeholder="Dan number" />
            <UInput v-model="editForm.color" placeholder="Color (e.g., #FFFFFF)" />
            <UInput v-model="editForm.description" placeholder="Description" />
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
definePageMeta({ layout: 'settings' })

const toast = useToast()
const ranks = ref<any[]>([])
const creating = ref(false)
const updating = ref(false)

const typeOptions = [
  { label: 'Kyu', value: 'kyu' },
  { label: 'Dan', value: 'dan' },
]

const newRank = reactive({
  name: '',
  level: '',
  order: null as number | null,
  type: 'kyu',
  danNumber: null as number | null,
  color: '',
  description: '',
})

const editingRank = ref<any>(null)
const editForm = reactive({
  name: '',
  level: '',
  order: null as number | null,
  type: 'kyu',
  danNumber: null as number | null,
  color: '',
  description: '',
})

async function loadRanks() {
  try {
    const data = await $fetch('/api/belt-ranks')
    ranks.value = data
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load ranks',
      description: error.data?.statusMessage || error.message,
    })
  }
}

async function createRank() {
  if (!newRank.name || !newRank.level || !newRank.order) {
    toast.add({ color: 'warning', title: 'Name, level, and order are required' })
    return
  }

  creating.value = true
  try {
    const response = await $fetch('/api/belt-ranks', {
      method: 'POST',
      body: {
        name: newRank.name,
        level: newRank.level,
        order: newRank.order,
        type: newRank.type,
        danNumber: newRank.danNumber || undefined,
        color: newRank.color || undefined,
        description: newRank.description || undefined,
      },
    })
    if (response.success) {
      toast.add({ color: 'success', title: 'Rank created' })
      // Reset form
      Object.assign(newRank, {
        name: '',
        level: '',
        order: null,
        type: 'kyu',
        danNumber: null,
        color: '',
        description: '',
      })
      await loadRanks()
    }
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Creation failed',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    creating.value = false
  }
}

function startEdit(rank: any) {
  editingRank.value = rank
  editForm.name = rank.name
  editForm.level = rank.level
  editForm.order = rank.order
  editForm.type = rank.type
  editForm.danNumber = rank.danNumber
  editForm.color = rank.color || ''
  editForm.description = rank.description || ''
}

function cancelEdit() {
  editingRank.value = null
  editForm.name = ''
  editForm.level = ''
  editForm.order = null
  editForm.type = 'kyu'
  editForm.danNumber = null
  editForm.color = ''
  editForm.description = ''
}

async function updateRank() {
  if (!editingRank.value) return
  if (!editForm.name || !editForm.level || !editForm.order) {
    toast.add({ color: 'warning', title: 'Name, level, and order are required' })
    return
  }

  updating.value = true
  try {
    const response = await $fetch(`/api/belt-ranks/${editingRank.value.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        level: editForm.level,
        order: editForm.order,
        type: editForm.type,
        danNumber: editForm.danNumber || null,
        color: editForm.color || null,
        description: editForm.description || null,
      },
    })
    if (response.success) {
      toast.add({ color: 'success', title: 'Rank updated' })
      cancelEdit()
      await loadRanks()
    }
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Update failed',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    updating.value = false
  }
}

async function deleteRank(id: number) {
  if (!confirm('Delete this belt rank?')) return
  try {
    await $fetch(`/api/belt-ranks/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Rank deleted' })
    await loadRanks()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Deletion failed',
      description: error.data?.statusMessage || error.message,
    })
  }
}

onMounted(loadRanks)
</script>