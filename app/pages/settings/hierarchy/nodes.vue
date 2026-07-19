<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-2">Organization structure</h1>
    <UCard class="mb-6 border-primary/20 bg-primary/5">
      <div class="flex gap-3">
        <UIcon name="i-lucide-circle-help" class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h2 class="font-semibold">How to set this up</h2>
          <ol class="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <li><strong>1. Start with the largest area</strong> you manage, such as India or Gujarat.</li>
            <li><strong>2. Use “Add …” beside a location</strong> to create the next smaller area under it.</li>
            <li><strong>3. Add dojos separately</strong> from Dojos &amp; schedules once their location is ready.</li>
          </ol>
          <p v-if="structurePath" class="mt-3 text-sm text-slate-500">Your available structure: <strong>{{ structurePath }}</strong></p>
          <p class="mt-1 text-xs text-slate-500">You can only add or change locations in areas assigned to you.</p>
        </div>
      </div>
    </UCard>
    <p class="mb-6 max-w-3xl text-sm text-slate-600 dark:text-slate-300">Build from a larger area to a smaller one. For example: country, state, district, city, then branch.</p>

    <UCard v-if="isOwner && canAddHierarchy && levels.length < 2" class="mb-6 border-primary/30 bg-primary/5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="font-semibold">{{ hierarchyHeading }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ hierarchyGuidance }}</p>
        </div>
        <UButton :loading="addingCommonLevels" icon="i-lucide-sparkles" @click="addCommonLevels">Add available types</UButton>
      </div>
    </UCard>

    <details v-if="isOwner && canCreateCustomTypes" class="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <summary class="cursor-pointer font-semibold">Advanced: change the location types</summary>
      <p class="mt-1 text-sm text-gray-500">Location types describe your structure, such as <strong>Country</strong>, <strong>State</strong>, or a custom type. Most organizations can use the available types below.</p>
      <form class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]" @submit.prevent="createCustomLevel">
        <UInput v-model="newLevelName" placeholder="Custom type, e.g. Region or Zone" />
        <UButton type="submit" :loading="creatingLevel">Add custom type</UButton>
      </form>
      <div class="mt-3 flex flex-wrap gap-2"><UButton v-for="preset in levelPresets" :key="preset" size="xs" variant="outline" :disabled="hasLevel(preset)" @click="addPresetLevel(preset)">+ {{ preset }}</UButton></div>
    </details>

    <UAlert v-if="hasManagedTerritory && !canManageHierarchy" class="mb-6" color="warning" title="Adding locations requires State Pro or National" description="Your assigned area is recognised, but this workspace plan cannot add or reorganize locations. Ask the organization owner to upgrade the workspace, then return here to add locations below your assigned area." />

    <!-- Add Root Node -->
    <UCard v-if="isOwner && canAddHierarchy && tree.length === 0" class="mb-6">
      <h3 class="text-lg font-semibold mb-1">Add your first location</h3>
      <p class="mb-3 text-sm text-gray-500">Choose its type first, then enter its real name. Example: <strong>Country</strong> → <strong>India</strong>.</p>
      <form @submit.prevent="createRootNode">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <USelect
            v-model="newRoot.levelId"
            :items="rootLevelOptions"
            placeholder="1. Choose location type"
            required
          />
          <UInput v-model="newRoot.name" placeholder="2. Location name, e.g. India" required />
          <UButton type="submit" :loading="creatingRoot">Save location</UButton>
        </div>
      </form>
    </UCard>

    <!-- Tree View -->
    <UCard>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="text-lg font-semibold">Your locations</h2><p v-if="canAddWithinTerritory" class="mt-1 text-sm text-slate-500 dark:text-slate-400">Use the “Add …” button beside a location to create the next area under it.</p></div>
      </div>
      <div v-if="tree.length === 0" class="text-gray-500">No locations yet. Add your first location above.</div>
      <div v-else>
        <!-- ✅ Force re-render with :key="tree.length" -->
        <HierarchyTreeNode
          v-for="node in tree"
          :key="node.id"
          :node="node"
          :levels="levels"
          :can-manage-children="canManageChildren"
          :can-add-children="canAddChildren"
          :next-child-level-name="nextChildLevelName"
          :can-modify="canModify"
          @add-child="openAddChild"
          @edit="openEdit"
          @delete="deleteNode"
        />
      </div>

      <!-- Inline Add Child Form -->
      <div v-if="addingChildParent" class="mt-4 border-t pt-4">
        <h4 class="font-semibold">Add {{ nextChildLevelName(addingChildParent) }} under "{{ addingChildParent.name }}"</h4>
        <p class="mt-1 text-sm text-slate-500">Enter the name of this {{ nextChildLevelName(addingChildParent).toLowerCase() }}, then save.</p>
        <form @submit.prevent="createChildNode" class="mt-2">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UInput :model-value="nextChildLevelName(addingChildParent)" disabled />
            <UInput v-model="newChild.name" :placeholder="`Name of the ${nextChildLevelName(addingChildParent).toLowerCase()}`" required />
            <UButton type="submit" :loading="creatingChild">Add {{ nextChildLevelName(addingChildParent) }}</UButton>
          </div>
          <UButton type="button" color="neutral" size="sm" class="mt-2" @click="cancelAddChild">Cancel</UButton>
        </form>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingNode" class="mt-4 border-t pt-4">
        <h4 class="font-semibold">Update "{{ nodeLabel(editingNode) }}"</h4>
        <form @submit.prevent="updateNode" class="mt-2">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <USelect
              v-model="editForm.levelId"
              :items="levelOptions"
              placeholder="Location type"
              required
            />
            <UInput v-model="editForm.name" placeholder="Location name" required />
            <USelect
              v-model="editForm.parentId"
              :items="parentOptions"
              placeholder="Location above this one"
            />
            <UButton type="submit" :loading="updating">Save changes</UButton>
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
const { data: subscription } = await useFetch<{ plan: string }>('/api/organization/subscription')
const { data: permissions, refresh: refreshPermissions } = await useFetch<{ allowedNodeIds: number[], managedParentNodeIds: number[] }>('/api/users/me/permissions')
const levels = ref<any[]>([])
const nodes = ref<any[]>([])
const tree = ref<any[]>([])

const creatingRoot = ref(false)
const creatingChild = ref(false)
const updating = ref(false)
const addingCommonLevels = ref(false)
const creatingLevel = ref(false)
const newLevelName = ref('')
const allLevelPresets = ['Country', 'State / Province', 'District', 'City / Town', 'Branch']
const allowedPresetNames = computed<string[] | null>(() => {
  const plan = subscription.value?.plan || 'free'
  if (plan === 'national') return null
  if (plan === 'state-pro') return ['State / Province', 'District', 'City / Town', 'Branch']
  return []
})
const levelPresets = computed(() => allowedPresetNames.value === null ? allLevelPresets : allLevelPresets.filter(name => allowedPresetNames.value?.includes(name)))
const canCreateCustomTypes = computed(() => subscription.value?.plan === 'national')
const canAddHierarchy = computed(() => allowedPresetNames.value === null || allowedPresetNames.value.length > 0)
const canManageHierarchy = computed(() => ['state-pro', 'national'].includes(subscription.value?.plan || ''))
const hierarchyHeading = computed(() => subscription.value?.plan === 'state-pro' ? 'Build your in-state structure' : ['city-starter', 'city-pro'].includes(subscription.value?.plan || '') ? 'Keep your city workspace simple' : 'Add location types when you need them')
const hierarchyGuidance = computed(() => subscription.value?.plan === 'state-pro' ? 'State Pro supports State, District, City/Town, and Branch. Country-level structure is available on National.' : ['city-starter', 'city-pro'].includes(subscription.value?.plan || '') ? 'Your locations are already limited to one city, so no extra organization structure is needed. Add and manage locations from Dojos & schedules.' : 'A single dojo can stay simple. For a wider organization, add Country, State, City, Branch, or your own custom location type before adding those locations.')

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
  return levelOptions.value.filter(option => levels.value.find(level => level.id === option.value)?.order === firstOrder).filter(isLevelAllowed)
})
const availableChildLevels = (node: any) => {
  const parentLevel = levels.value.find(level => Number(level.id) === Number(node?.levelId))
  if (!parentLevel) return []
  const lowerLevels = levels.value
    .filter(level => level.order > parentLevel.order && isLevelAllowed({ value: level.id }))
    .sort((a, b) => a.order - b.order)
  const nextOrder = lowerLevels[0]?.order
  return nextOrder === undefined ? [] : lowerLevels.filter(level => level.order === nextOrder)
}
const childLevelOptions = computed(() => {
  return availableChildLevels(addingChildParent.value).map(level => ({ label: level.name, value: level.id }))
})
const canManageChildren = (nodeId: number) => isOwner.value || permissions.value?.managedParentNodeIds.includes(nodeId) || false
const canModify = (nodeId: number) => canManageHierarchy.value && (isOwner.value || permissions.value?.allowedNodeIds.includes(nodeId) || false)
const isLevelAllowed = (option: { value: number }) => {
  const level = levels.value.find(item => Number(item.id) === Number(option.value))
  // A dojo is an operational record, with schedules and other data. It is
  // created only from Dojos & schedules, never as a standalone tree node.
  if (!level || level.name.trim().toLowerCase() === 'dojo') return false
  return allowedPresetNames.value === null || allowedPresetNames.value.includes(level.name)
}
// The allowed types depend on the asynchronously loaded subscription. Keep
// this computed so a National/State plan updates the dropdown after it loads.
const levelOptions = computed(() => levels.value
  .map((level: any) => ({ label: level.name, value: level.id }))
  .filter(isLevelAllowed))
const canAddChildren = (node: any) => {
  return availableChildLevels(node).length > 0
}
const nextChildLevelName = (node: any) => availableChildLevels(node)[0]?.name || 'location'
const structurePath = computed(() => levels.value
  .filter(level => isLevelAllowed({ value: level.id }))
  .sort((a, b) => a.order - b.order)
  .map(level => level.name)
  .join(' → '))
const flatNodes = computed(() => {
  const result: any[] = []
  const visit = (items: any[]) => items.forEach((item) => { result.push(item); visit(item.children || []) })
  visit(tree.value)
  return result
})
// Display every parent the caller manages. The child form below still limits
// choices to valid lower hierarchy types, but this must not hide the entry
// point for a legitimate State/District/City Head.
const managedParentNodes = computed(() => flatNodes.value.filter(node => canManageChildren(node.id)))
const nodeLabel = (node: any) => {
  const level = levels.value.find(item => Number(item.id) === Number(node.levelId))
  return `${node.name} — ${level?.name || 'Hierarchy node'}`
}
const canAddWithinTerritory = computed(() => canManageHierarchy.value && managedParentNodes.value.length > 0)
const hasManagedTerritory = computed(() => !isOwner.value && (permissions.value?.managedParentNodeIds.length || 0) > 0)
const parentOptions = computed(() => {
  if (!editingNode.value) return []
  const currentLevel = levels.value.find(level => level.id === editForm.levelId)
  return [
    { label: 'No parent (root node)', value: null },
    ...flatNodes.value
      .filter(node => node.id !== editingNode.value.id && (levels.value.find(level => level.id === node.levelId)?.order || 0) < (currentLevel?.order || 0))
      .map(node => ({ label: nodeLabel(node), value: node.id })),
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
    toast.add({ color: 'success', title: 'Location added' })
    newRoot.levelId = undefined
    newRoot.name = ''
    await refreshHierarchy()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Could not add location',
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
    await refreshHierarchy()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not add hierarchy levels', description: error.data?.statusMessage || error.message })
  } finally {
    addingCommonLevels.value = false
  }
}

async function refreshHierarchy() {
  await Promise.all([loadData(), refreshPermissions()])
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
    await refreshHierarchy()
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
  newChild.levelId = childLevelOptions.value[0]?.value
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
    toast.add({ color: 'success', title: 'Location added' })
    cancelAddChild()
    await refreshHierarchy()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Could not add location',
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
    toast.add({ color: 'success', title: 'Location updated' })
    cancelEdit()
    await refreshHierarchy()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Could not update location',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    updating.value = false
  }
}

async function deleteNode(id: number) {
  if (!confirm('Remove this empty location? This cannot be undone.')) return
  try {
    await $fetch(`/api/hierarchy/nodes/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Location removed' })
    await refreshHierarchy()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Could not remove location',
      description: error.data?.statusMessage || error.message,
    })
  }
}

onMounted(loadData)
</script>
