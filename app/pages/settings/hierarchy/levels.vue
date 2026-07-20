<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-2">Hierarchy Types</h1>
    <p class="mb-6 text-sm text-gray-500">A type describes the structure, such as Country or Branch. Add the real locations—such as Canada or Sunrise Karate—on the Hierarchy Nodes page.</p>

    <!-- Create Level Form -->
    <UCard class="mb-6">
      <form @submit.prevent="createLevel">
        <div class="flex gap-4">
          <UInput v-model="newLevelName" placeholder="Type name (e.g., Country or Region)" class="flex-1" required />
          <UButton type="submit" :loading="creating">Add type</UButton>
        </div>
      </form>
    </UCard>

    <!-- Level List -->
    <UCard>
      <h2 class="text-lg font-semibold mb-4">Your hierarchy types</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="level in levels" :key="level.id">
              <td class="px-6 py-4 whitespace-nowrap">{{ level.order }}</td>
              <td class="px-6 py-4 whitespace-nowrap">{{ level.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <UButton color="primary" variant="ghost" size="sm" @click="startEdit(level)">Edit</UButton>
                <UButton color="error" variant="ghost" size="sm" @click="deleteLevel(level.id)">Delete</UButton>
              </td>
            </tr>
            <tr v-if="levels.length === 0">
              <td colspan="3" class="px-6 py-4 text-center text-gray-500">No hierarchy types created yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingLevel" class="mt-6 border-t pt-4">
        <h3 class="text-lg font-semibold mb-3">Edit Level</h3>
        <form @submit.prevent="updateLevel">
          <div class="flex gap-4">
            <UInput v-model="editForm.name" placeholder="Level name" required />
            <UInput v-model.number="editForm.order" type="number" placeholder="Order" required />
            <UButton type="submit" :loading="updating">Update</UButton>
            <UButton type="button" color="neutral" @click="cancelEdit">Cancel</UButton>
          </div>
        </form>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['auth', 'admin'] })

const toast = useToast()
const levels = ref<any[]>([])
const newLevelName = ref('')
const creating = ref(false)

const editingLevel = ref<any>(null)
const editForm = reactive({
  name: '',
  order: 0,
})
const updating = ref(false)

async function loadLevels() {
  try {
    const data = await $fetch('/api/hierarchy/levels')
    levels.value = data
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load levels',
      description: error.data?.statusMessage || error.message,
    })
  }
}

async function createLevel() {
  const name = newLevelName.value.trim()
  if (!name) {
    toast.add({ color: 'warning', title: 'Please enter a level name' })
    return
  }

  creating.value = true
  try {
    const response = await $fetch('/api/hierarchy/levels', {
      method: 'POST',
      body: { name },
    })
    if (response.success) {
      toast.add({ color: 'success', title: 'Level created' })
      newLevelName.value = ''
      await loadLevels()
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

function startEdit(level: any) {
  editingLevel.value = level
  editForm.name = level.name
  editForm.order = level.order
}

function cancelEdit() {
  editingLevel.value = null
  editForm.name = ''
  editForm.order = 0
}

async function updateLevel() {
  if (!editingLevel.value) return
  if (!editForm.name.trim() || !editForm.order) {
    toast.add({ color: 'warning', title: 'Name and order are required' })
    return
  }

  updating.value = true
  try {
    const response = await $fetch(`/api/hierarchy/levels/${editingLevel.value.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.name.trim(),
        order: editForm.order,
      },
    })
    if (response.success) {
      toast.add({ color: 'success', title: 'Level updated' })
      cancelEdit()
      await loadLevels()
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

async function deleteLevel(id: number) {
  if (!confirm('Delete this level?')) return
  try {
    await $fetch(`/api/hierarchy/levels/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Level deleted' })
    await loadLevels()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Deletion failed',
      description: error.data?.statusMessage || error.message,
    })
  }
}

onMounted(loadLevels)

console.log('🔍 Hierarchy Levels page loaded')
</script>
