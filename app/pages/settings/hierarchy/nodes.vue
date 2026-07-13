<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Hierarchy Nodes</h1>

    <!-- Add Root Node -->
    <UCard v-if="isOwner" class="mb-6">
      <h3 class="text-lg font-semibold mb-3">Add Root Node</h3>
      <form @submit.prevent="createRootNode">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <USelect
            v-model="newRoot.levelId"
            :items="levelOptions"
            placeholder="Select level"
            required
          />
          <UInput v-model="newRoot.name" placeholder="Node name" required />
          <UButton type="submit" :loading="creatingRoot">Add Root</UButton>
        </div>
      </form>
    </UCard>

    <!-- Tree View -->
    <UCard>
      <h2 class="text-lg font-semibold mb-4">Your Hierarchy</h2>
      <div v-if="tree.length === 0" class="text-gray-500">No nodes yet. Add a root node above.</div>
      <div v-else>
        <!-- ✅ Force re-render with :key="tree.length" -->
        <HierarchyTreeNode
          v-for="node in tree"
          :key="node.id"
          :node="node"
          :levels="levels"
          :can-manage-children="canManageChildren"
          :can-modify="canModify"
          @add-child="openAddChild"
          @edit="openEdit"
          @delete="deleteNode"
        />
      </div>

      <!-- Inline Add Child Form -->
      <div v-if="addingChildParent" class="mt-4 border-t pt-4">
        <h4 class="font-semibold">Add child under "{{ addingChildParent.name }}"</h4>
        <form @submit.prevent="createChildNode" class="mt-2">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <USelect
              v-model="newChild.levelId"
              :items="levelOptions"
              placeholder="Select level"
              required
            />
            <UInput v-model="newChild.name" placeholder="Child node name" required />
            <UButton type="submit" :loading="creatingChild">Add Child</UButton>
          </div>
          <UButton type="button" color="neutral" size="sm" class="mt-2" @click="cancelAddChild">Cancel</UButton>
        </form>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingNode" class="mt-4 border-t pt-4">
        <h4 class="font-semibold">Edit "{{ editingNode.name }}"</h4>
        <form @submit.prevent="updateNode" class="mt-2">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <USelect
              v-model="editForm.levelId"
              :items="levelOptions"
              placeholder="Select level"
              required
            />
            <UInput v-model="editForm.name" placeholder="Node name" required />
            <UButton type="submit" :loading="updating">Update</UButton>
          </div>
          <UButton type="button" color="neutral" size="sm" class="mt-2" @click="cancelEdit">Cancel</UButton>
        </form>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const { user } = useUserSession()
const { data: permissions } = await useFetch<{ allowedNodeIds: number[], managedParentNodeIds: number[] }>('/api/users/me/permissions')
const levels = ref<any[]>([])
const nodes = ref<any[]>([])
const tree = ref<any[]>([])
const levelOptions = ref<{ label: string; value: number }[]>([])

const creatingRoot = ref(false)
const creatingChild = ref(false)
const updating = ref(false)

const newRoot = reactive({
  levelId: undefined as number | undefined,
  name: '',
})

const addingChildParent = ref<any>(null)
const newChild = reactive({
  levelId: undefined as number | undefined,
  name: '',
})

const editingNode = ref<any>(null)
const editForm = reactive({
  levelId: undefined as number | undefined,
  name: '',
})

const isOwner = computed(() => user.value?.role === 'owner')
const canManageChildren = (nodeId: number) => isOwner.value || permissions.value?.managedParentNodeIds.includes(nodeId) || false
const canModify = (nodeId: number) => isOwner.value || permissions.value?.allowedNodeIds.includes(nodeId) || false

// Load levels and nodes
async function loadData() {
  try {
    const [levelsData, nodesData] = await Promise.all([
      $fetch('/api/hierarchy/levels'),
      $fetch('/api/hierarchy/nodes'),
    ])
    levels.value = levelsData
    levelOptions.value = levelsData.map((l: any) => ({ label: l.name, value: l.id }))
    
    // ✅ The API already returns nested tree, so use it directly
    tree.value = nodesData
    console.log('🌳 Tree loaded:', tree.value)
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load data',
      description: error.data?.statusMessage || error.message,
    })
  }
}
// Build tree from flat nodes
async function createRootNode() {
  if (!newRoot.levelId || !newRoot.name.trim()) {
    toast.add({ color: 'warning', title: 'Level and name are required' })
    return
  }

  creatingRoot.value = true
  try {
    await $fetch('/api/hierarchy/nodes', {
      method: 'POST',
      body: {
        levelId: newRoot.levelId,
        name: newRoot.name.trim(),
        parentId: null,
      },
    })
    toast.add({ color: 'success', title: 'Node created' })
    newRoot.levelId = undefined
    newRoot.name = ''
    await loadData()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Creation failed',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    creatingRoot.value = false
  }
}

function openAddChild(parent: any) {
  addingChildParent.value = parent
  newChild.levelId = undefined
  newChild.name = ''
}

function cancelAddChild() {
  addingChildParent.value = null
  newChild.levelId = undefined
  newChild.name = ''
}

async function createChildNode() {
  if (!addingChildParent.value) return
  if (!newChild.levelId || !newChild.name.trim()) {
    toast.add({ color: 'warning', title: 'Level and name are required' })
    return
  }

  creatingChild.value = true
  try {
    await $fetch('/api/hierarchy/nodes', {
      method: 'POST',
      body: {
        levelId: newChild.levelId,
        name: newChild.name.trim(),
        parentId: addingChildParent.value.id,
      },
    })
    toast.add({ color: 'success', title: 'Child node created' })
    cancelAddChild()
    await loadData()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Creation failed',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    creatingChild.value = false
  }
}

function openEdit(node: any) {
  editingNode.value = node
  editForm.levelId = node.levelId
  editForm.name = node.name
}

function cancelEdit() {
  editingNode.value = null
  editForm.levelId = undefined
  editForm.name = ''
}

async function updateNode() {
  if (!editingNode.value) return
  if (!editForm.levelId || !editForm.name.trim()) {
    toast.add({ color: 'warning', title: 'Level and name are required' })
    return
  }

  updating.value = true
  try {
    await $fetch(`/api/hierarchy/nodes/${editingNode.value.id}`, {
      method: 'PATCH' as any,
      body: {
        levelId: editForm.levelId,
        name: editForm.name.trim(),
      },
    })
    toast.add({ color: 'success', title: 'Node updated' })
    cancelEdit()
    await loadData()
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

async function deleteNode(id: number) {
  if (!confirm('Delete this node? All children will also be deleted.')) return
  try {
    await $fetch(`/api/hierarchy/nodes/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Node deleted' })
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
