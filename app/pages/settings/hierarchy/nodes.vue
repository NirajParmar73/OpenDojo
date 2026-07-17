<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Hierarchy Nodes</h1>

    <UCard v-if="isOwner && levels.length < 2" class="mb-6 border-primary/30 bg-primary/5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="font-semibold">Add hierarchy types when you need them</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">A single dojo can stay simple. For a wider organization, add Country, State, City, Branch, or your own custom type before adding those locations.</p>
        </div>
        <UButton :loading="addingCommonLevels" icon="i-lucide-sparkles" @click="addCommonLevels">Add starter types</UButton>
      </div>
    </UCard>

    <UCard v-if="isOwner" class="mb-6">
      <h2 class="text-lg font-semibold">1. Define a hierarchy type</h2>
      <p class="mt-1 text-sm text-gray-500">Types describe the structure, such as <strong>Country</strong>, <strong>State</strong>, or a custom type. A new type starts at the top; you can adjust its order later on the Hierarchy Types page.</p>
      <form class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]" @submit.prevent="createCustomLevel">
        <UInput v-model="newLevelName" placeholder="Custom type, e.g. Region or Zone" />
        <UButton type="submit" :loading="creatingLevel">Add custom type</UButton>
      </form>
      <div class="mt-3 flex flex-wrap gap-2"><UButton v-for="preset in levelPresets" :key="preset" size="xs" variant="outline" :disabled="hasLevel(preset)" @click="addPresetLevel(preset)">+ {{ preset }}</UButton></div>
    </UCard>

    <!-- Add Root Node -->
    <UCard v-if="isOwner" class="mb-6">
      <h3 class="text-lg font-semibold mb-1">2. Add a top-level location</h3>
      <p class="mb-3 text-sm text-gray-500">Choose its type first, then enter its real name. Example: <strong>Country</strong> → <strong>India</strong>.</p>
      <form @submit.prevent="createRootNode">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <USelect
            v-model="newRoot.levelId"
            :items="rootLevelOptions"
            placeholder="Choose hierarchy type"
            required
          />
          <UInput v-model="newRoot.name" placeholder="Location name, e.g. India" required />
          <UButton type="submit" :loading="creatingRoot">Add location</UButton>
        </div>
      </form>
    </UCard>

    <!-- Tree View -->
    <UCard>
      <h2 class="text-lg font-semibold mb-4">Your Hierarchy</h2>
      <div v-if="tree.length === 0" class="text-gray-500">No locations yet. Add a top-level location above.</div>
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
        <h4 class="font-semibold">Add location under "{{ addingChildParent.name }}"</h4>
        <form @submit.prevent="createChildNode" class="mt-2">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <USelect
              v-model="newChild.levelId"
              :items="childLevelOptions"
              placeholder="Choose hierarchy type"
              required
            />
            <UInput v-model="newChild.name" placeholder="Location name" required />
            <UButton type="submit" :loading="creatingChild">Add location</UButton>
          </div>
          <UButton type="button" color="neutral" size="sm" class="mt-2" @click="cancelAddChild">Cancel</UButton>
        </form>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingNode" class="mt-4 border-t pt-4">
        <h4 class="font-semibold">Edit "{{ editingNode.name }}"</h4>
        <form @submit.prevent="updateNode" class="mt-2">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <USelect
              v-model="editForm.levelId"
              :items="levelOptions"
              placeholder="Select level"
              required
            />
            <UInput v-model="editForm.name" placeholder="Node name" required />
            <USelect
              v-model="editForm.parentId"
              :items="parentOptions"
              placeholder="Parent node"
            />
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
const addingCommonLevels = ref(false)
const creatingLevel = ref(false)
const newLevelName = ref('')
const levelPresets = ['Country', 'State / Province', 'District', 'City / Town', 'Branch']

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
  parentId: null as number | null,
})

const isOwner = computed(() => user.value?.role === 'owner')
const hasLevel = (name: string) => levels.value.some(level => level.name.trim().toLowerCase() === name.toLowerCase())
const rootLevelOptions = computed(() => {
  const firstOrder = Math.min(...levels.value.map(level => level.order))
  return levelOptions.value.filter(option => levels.value.find(level => level.id === option.value)?.order === firstOrder)
})
const childLevelOptions = computed(() => {
  const parentLevel = levels.value.find(level => level.id === addingChildParent.value?.levelId)
  if (!parentLevel) return []
  return levelOptions.value.filter(option => (levels.value.find(level => level.id === option.value)?.order || 0) > parentLevel.order)
})
const canManageChildren = (nodeId: number) => isOwner.value || permissions.value?.managedParentNodeIds.includes(nodeId) || false
const canModify = (nodeId: number) => isOwner.value || permissions.value?.allowedNodeIds.includes(nodeId) || false
const flatNodes = computed(() => {
  const result: any[] = []
  const visit = (items: any[]) => items.forEach((item) => { result.push(item); visit(item.children || []) })
  visit(tree.value)
  return result
})
const parentOptions = computed(() => {
  if (!editingNode.value) return []
  const currentLevel = levels.value.find(level => level.id === editForm.levelId)
  return [
    { label: 'No parent (root node)', value: null },
    ...flatNodes.value
      .filter(node => node.id !== editingNode.value.id && (levels.value.find(level => level.id === node.levelId)?.order || 0) < (currentLevel?.order || 0))
      .map(node => ({ label: node.name, value: node.id })),
  ]
})

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

async function addCommonLevels() {
  addingCommonLevels.value = true
  try {
    const result = await $fetch<{ created: number }>('/api/hierarchy/levels/common', { method: 'POST' })
    toast.add({ color: 'success', title: result.created ? 'Common hierarchy levels added' : 'Common levels are already available' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not add hierarchy levels', description: error.data?.statusMessage || error.message })
  } finally {
    addingCommonLevels.value = false
  }
}

async function createCustomLevel() {
  const name = newLevelName.value.trim()
  if (!name) {
    toast.add({ color: 'warning', title: 'Enter a hierarchy type' })
    return
  }
  if (hasLevel(name)) {
    toast.add({ color: 'warning', title: 'This hierarchy type already exists' })
    return
  }
  creatingLevel.value = true
  try {
    await $fetch('/api/hierarchy/levels', { method: 'POST', body: { name, order: 1 } })
    newLevelName.value = ''
    toast.add({ color: 'success', title: 'Hierarchy type added' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not add hierarchy type', description: error.data?.statusMessage || error.message })
  } finally {
    creatingLevel.value = false
  }
}

async function addPresetLevel(name: string) {
  newLevelName.value = name
  await createCustomLevel()
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
  editForm.parentId = node.parentId
}

function cancelEdit() {
  editingNode.value = null
  editForm.levelId = undefined
  editForm.name = ''
  editForm.parentId = null
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
        parentId: editForm.parentId,
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
