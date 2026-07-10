<template>
  <div class="max-w-5xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Dojo Management</h1>

    <!-- Create Form -->
    <UCard class="mb-6">
      <h3 class="text-lg font-semibold mb-3">Add Dojo</h3>
      <form @submit.prevent="createDojo">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <USelect
            v-model="newDojo.nodeId"
            :items="nodeOptions"
            placeholder="Select hierarchy node"
            required
            class="w-full"
            :title="getNodePath(newDojo.nodeId || 0)"
          />
          <UInput v-model="newDojo.name" placeholder="Dojo name" required />
          <UButton type="submit" :loading="creating">Add Dojo</UButton>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <UInput v-model="newDojo.address" placeholder="Address (optional)" />
          <UInput v-model="newDojo.phone" placeholder="Phone (optional)" />
          <UInput v-model="newDojo.email" placeholder="Email (optional)" />
        </div>
      </form>
    </UCard>

    <!-- Dojo List -->
    <UCard>
      <h2 class="text-lg font-semibold mb-4">Your Dojos</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hierarchy Path</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="dojo in dojos" :key="dojo.id">
              <td class="px-6 py-4">{{ dojo.name }}</td>
              <td class="px-6 py-4">{{ getNodePath(dojo.nodeId) }}</td>
              <td class="px-6 py-4">{{ dojo.address || '-' }}</td>
              <td class="px-6 py-4">{{ dojo.phone || '-' }}</td>
              <td class="px-6 py-4">
                <UButton color="primary" variant="ghost" size="sm" @click="startEdit(dojo)">Edit</UButton>
                <UButton color="error" variant="ghost" size="sm" @click="deleteDojo(dojo.id)">Delete</UButton>
              </td>
            </tr>
            <tr v-if="dojos.length === 0">
              <td colspan="5" class="px-6 py-4 text-center text-gray-500">No dojos yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingDojo" class="mt-6 border-t pt-4">
        <h3 class="text-lg font-semibold mb-3">Edit Dojo</h3>
        <form @submit.prevent="updateDojo">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <USelect
              v-model="editForm.nodeId"
              :items="nodeOptions"
              placeholder="Select hierarchy node"
              required
              class="w-full"
              :title="getNodePath(editForm.nodeId || 0)"
            />
            <UInput v-model="editForm.name" placeholder="Dojo name" required />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <UInput v-model="editForm.address" placeholder="Address" />
            <UInput v-model="editForm.phone" placeholder="Phone" />
            <UInput v-model="editForm.email" placeholder="Email" />
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
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const dojos = ref<any[]>([])
const allNodes = ref<any[]>([])
const flatNodes = ref<any[]>([])
const levels = ref<any[]>([])
const creating = ref(false)
const updating = ref(false)
const editingDojo = ref<any>(null)

const newDojo = reactive({
  nodeId: null as number | null,
  name: '',
  address: '',
  phone: '',
  email: '',
})

const editForm = reactive({
  nodeId: null as number | null,
  name: '',
  address: '',
  phone: '',
  email: '',
})

// Flatten nested tree to flat array
function flattenTree(tree: any[]): any[] {
  let result: any[] = []
  for (const node of tree) {
    result.push({ ...node })
    if (node.children && node.children.length) {
      result = result.concat(flattenTree(node.children))
    }
  }
  return result
}

// Build path map with duplicate removal
function buildPathMap(nodes: any[]): Record<number, string> {
  const nodeMap: Record<number, any> = {}
  for (const node of nodes) {
    nodeMap[node.id] = node
  }

  const pathMap: Record<number, string> = {}
  for (const node of nodes) {
    const pathParts: string[] = []
    let current: any = node
    let lastAddedName: string | null = null
    while (current) {
      if (current.name !== lastAddedName) {
        pathParts.unshift(current.name)
        lastAddedName = current.name
      }
      if (current.parentId && nodeMap[current.parentId]) {
        current = nodeMap[current.parentId]
      } else {
        break
      }
    }
    pathMap[node.id] = pathParts.join(' → ')
  }
  return pathMap
}

function getNodePath(nodeId: number): string {
  return nodePathMap.value[nodeId] || 'Unknown'
}

const nodePathMap = ref<Record<number, string>>({})

// Node options for dropdown (simple label)
const nodeOptions = computed(() => {
  return flatNodes.value.map((node: any) => ({
    label: getNodePath(node.id),
    value: node.id,
  }))
})

async function loadData() {
  try {
    const [dojosData, nodesData, levelsData] = await Promise.all([
      $fetch('/api/dojos'),
      $fetch('/api/hierarchy/nodes'),
      $fetch('/api/hierarchy/levels'),
    ])
    dojos.value = dojosData
    allNodes.value = nodesData
    levels.value = levelsData

    flatNodes.value = flattenTree(nodesData)
    nodePathMap.value = buildPathMap(flatNodes.value)
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load data',
      description: error.data?.statusMessage || error.message,
    })
  }
}

async function createDojo() {
  if (!newDojo.nodeId || !newDojo.name.trim()) {
    toast.add({ color: 'warning', title: 'Node and name are required' })
    return
  }

  creating.value = true
  try {
    const response = await $fetch('/api/dojos', {
      method: 'POST',
      body: {
        nodeId: newDojo.nodeId,
        name: newDojo.name.trim(),
        address: newDojo.address || undefined,
        phone: newDojo.phone || undefined,
        email: newDojo.email || undefined,
      },
    })
    if (response.success) {
      toast.add({ color: 'success', title: 'Dojo created' })
      Object.assign(newDojo, { nodeId: null, name: '', address: '', phone: '', email: '' })
      await loadData()
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

function startEdit(dojo: any) {
  editingDojo.value = dojo
  editForm.nodeId = dojo.nodeId
  editForm.name = dojo.name
  editForm.address = dojo.address || ''
  editForm.phone = dojo.phone || ''
  editForm.email = dojo.email || ''
}

function cancelEdit() {
  editingDojo.value = null
  editForm.nodeId = null
  editForm.name = ''
  editForm.address = ''
  editForm.phone = ''
  editForm.email = ''
}

async function updateDojo() {
  if (!editingDojo.value) return
  if (!editForm.nodeId || !editForm.name.trim()) {
    toast.add({ color: 'warning', title: 'Node and name are required' })
    return
  }

  updating.value = true
  try {
    const response = await $fetch(`/api/dojos/${editingDojo.value.id}`, {
      method: 'PATCH',
      body: {
        nodeId: editForm.nodeId,
        name: editForm.name.trim(),
        address: editForm.address || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
      },
    })
    if (response.success) {
      toast.add({ color: 'success', title: 'Dojo updated' })
      cancelEdit()
      await loadData()
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

async function deleteDojo(id: number) {
  if (!confirm('Delete this dojo? This will not delete students but will unlink them.')) return
  try {
    await $fetch(`/api/dojos/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Dojo deleted' })
    await loadData()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Deletion failed',
      description: error.data?.statusMessage || error.message,
    })
  }
}

onMounted(loadData)
</script>