<template>
  <div class="max-w-5xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Dojo Management</h1>

    <!-- Create Dojo Form -->
    <UCard v-if="canCreateDojo" class="mb-6">
      <form @submit.prevent="createDojo">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div v-if="isCityPlan || needsAutomaticHierarchy" class="flex items-center rounded-md border border-primary/20 bg-primary/5 px-3 text-sm text-slate-600 dark:text-slate-300">{{ isCityPlan ? 'City workspace location' : 'Starter hierarchy will be created automatically' }}</div>
          <USelect
            v-else
            v-model="newDojo.nodeId"
            :items="nodeOptions"
            placeholder="Choose the city or branch for this dojo"
            required
          />
          <UInput v-model="newDojo.name" placeholder="Dojo name" required />
        </div>
        <p v-if="isAdvancedPlan" class="mt-3 text-sm text-slate-500 dark:text-slate-400"><strong>Where should this dojo operate?</strong> Choose its City or Branch. States and districts organize your team and locations, so they are not direct dojo locations. <NuxtLink to="/settings/hierarchy/nodes" class="font-medium text-primary hover:underline">Add a missing city or branch in Organization structure.</NuxtLink></p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <UInput v-model="newDojo.address" placeholder="Address (optional)" />
          <UInput v-model="newDojo.city" :readonly="isLocationFieldLocked(newDojo.nodeId, 'city')" placeholder="City" />
          <UInput v-model="newDojo.stateProvince" :readonly="isLocationFieldLocked(newDojo.nodeId, 'stateProvince')" placeholder="State / province" />
          <UInput v-model="newDojo.country" :readonly="isLocationFieldLocked(newDojo.nodeId, 'country')" placeholder="Country" />
          <UInput v-model="newDojo.phone" placeholder="Phone (optional)" />
          <UInput v-model="newDojo.email" placeholder="Email (optional)" />
        </div>
        <p v-if="territoryMessage" class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ territoryMessage }}</p>
        <div class="mt-4 flex justify-end"><UButton type="submit" :loading="creating">Add Dojo</UButton></div>
      </form>
    </UCard>
    <UCard v-else class="mb-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="text-lg font-semibold">{{ isFreePlan ? 'Need another dojo?' : 'You have reached your dojo limit' }}</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ isFreePlan ? 'Free Forever includes one dojo location. Upgrade to add locations and manage them from this workspace.' : 'City Starter includes up to two dojo locations in one city. Upgrade to City Pro for more locations.' }}</p></div>
        <UButton to="/settings/subscription" icon="i-lucide-arrow-up-right">View upgrade options</UButton>
      </div>
    </UCard>

    <!-- Dojo List -->
    <UCard>
      <h2 class="text-lg font-semibold mb-4">Your Dojos</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Path</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="dojo in dojos" :key="dojo.id">
              <!-- Main dojo row -->
              <tr>
                <td class="px-6 py-4">{{ dojo.name }}</td>
                <td class="px-6 py-4">{{ getNodePath(dojo.nodeId) }}</td>
                <td class="px-6 py-4">{{ dojo.address || '-' }}</td>
                <td class="px-6 py-4">{{ dojo.phone || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <UButton color="primary" variant="ghost" size="sm" @click="startEdit(dojo)">Edit</UButton>
                  <UButton v-if="!isFreePlan" color="error" variant="ghost" size="sm" @click="deleteDojo(dojo.id)">Delete</UButton>
                  <UButton color="secondary" variant="ghost" size="sm" @click="toggleSchedules(dojo.id)">
                    {{ expandedDojoId === dojo.id ? 'Hide Schedules' : 'Schedules' }}
                  </UButton>
                </td>
              </tr>

              <!-- Schedules row (expanded) -->
              <tr v-if="expandedDojoId === dojo.id">
                <td colspan="5" class="bg-gray-50 px-6 py-4 dark:bg-slate-800/80">
                  <div class="pl-6">
                    <h4 class="font-medium mb-2">Schedules for {{ dojo.name }}</h4>

                    <div class="mb-5 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                      <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h5 class="font-medium">Dojo instructor roster</h5><p class="text-sm text-slate-500 dark:text-slate-400">Assign instructors who can teach at this dojo.</p></div></div>
                      <form class="mt-3 grid gap-3 md:grid-cols-4" @submit.prevent="assignInstructor(dojo.id)"><USelect v-model="dojoInstructorForm.userId" :items="instructorOptionsForDojo(dojo.id)" placeholder="Instructor" /><USelect v-model="dojoInstructorForm.programId" :items="programOptions" placeholder="Program" /><UCheckbox v-model="dojoInstructorForm.isPrimary" label="Primary instructor" /><UButton type="submit" size="sm" :loading="assigningInstructor">Assign instructor</UButton></form>
                      <div v-if="dojoInstructors[dojo.id]?.length" class="mt-3 flex flex-wrap gap-2"><UBadge v-for="assignment in dojoInstructors[dojo.id]" :key="assignment.id" color="primary" variant="subtle">{{ assignment.user?.name }}<span v-if="assignment.program"> · {{ assignment.program.displayName }}</span><span v-if="assignment.isPrimary"> · Primary</span></UBadge></div>
                    </div>

                    <!-- Add schedule form -->
                    <form @submit.prevent="addSchedule(dojo.id)" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                      <UFormField label="Day" required>
                        <USelect v-model="scheduleForm.dayOfWeek" :items="dayOptions" placeholder="Select a day" required />
                      </UFormField>
                      <UFormField label="Starts at" required>
                        <UInput v-model="scheduleForm.startTime" type="time" required />
                      </UFormField>
                      <UFormField label="Ends at" required>
                        <UInput v-model="scheduleForm.endTime" type="time" required />
                      </UFormField>
                      <UFormField label="Class name" required>
                        <UInput v-model="scheduleForm.name" required />
                      </UFormField>
                      <UFormField label="Program">
                        <USelect v-model="scheduleForm.programId" :items="programOptions" placeholder="Optional" />
                      </UFormField>
                      <UFormField label="Instructor">
                        <USelect v-model="scheduleForm.instructorId" :items="scheduledInstructorOptions(dojo.id)" placeholder="Optional" />
                      </UFormField>
                      <UButton type="submit" size="sm" :loading="addingSchedule">Add</UButton>
                    </form>

                    <!-- Schedule list -->
                    <div v-if="loadingSchedules" class="text-gray-500 dark:text-slate-400">Loading...</div>
                    <div v-else-if="schedules[dojo.id]?.length === 0" class="text-gray-500 dark:text-slate-400">No schedules yet.</div>
                    <div v-else>
                      <div v-for="sched in schedules[dojo.id]" :key="sched.id" class="flex items-center gap-4 border-b border-slate-200 py-2 dark:border-slate-700">
                        <span class="w-20">{{ getDayName(sched.dayOfWeek) }}</span>
                        <span>{{ sched.startTime }} – {{ sched.endTime }}</span>
                        <span class="font-medium">{{ sched.name }}</span>
                        <span v-if="sched.instructor" class="text-sm text-gray-600 dark:text-slate-300">{{ sched.instructor.name }}</span>
                        <span v-else class="text-sm text-gray-400 dark:text-slate-500">No instructor</span>
                        <UButton color="primary" variant="ghost" size="xs" @click="startEditSchedule(sched)">Edit</UButton>
                        <UButton color="error" variant="ghost" size="xs" @click="deleteSchedule(dojo.id, sched.id)">Delete</UButton>
                      </div>
                    </div>

                    <!-- Inline edit schedule form -->
                    <div v-if="editingSchedule" class="mt-4 border-t pt-4">
                      <h5 class="font-medium mb-2">Edit Schedule</h5>
                      <form @submit.prevent="updateSchedule(dojo.id)" class="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <UFormField label="Day" required>
                          <USelect v-model="editScheduleForm.dayOfWeek" :items="dayOptions" placeholder="Select a day" required />
                        </UFormField>
                        <UFormField label="Starts at" required>
                          <UInput v-model="editScheduleForm.startTime" type="time" required />
                        </UFormField>
                        <UFormField label="Ends at" required>
                          <UInput v-model="editScheduleForm.endTime" type="time" required />
                        </UFormField>
                        <UFormField label="Class name" required>
                          <UInput v-model="editScheduleForm.name" required />
                        </UFormField>
                        <UFormField label="Instructor">
                          <USelect v-model="editScheduleForm.instructorId" :items="scheduledInstructorOptions(dojo.id)" placeholder="Optional" />
                        </UFormField>
                        <UButton type="submit" size="sm" :loading="updatingSchedule">Update</UButton>
                        <UButton type="button" color="neutral" size="sm" @click="cancelEditSchedule">Cancel</UButton>
                      </form>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="dojos.length === 0">
              <td colspan="5" class="px-6 py-4 text-center text-gray-500">No dojos yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inline Edit Dojo Form (existing) -->
      <div v-if="editingDojo" class="mt-6 border-t pt-4">
        <h3 class="text-lg font-semibold mb-3">Edit Dojo</h3>
        <form @submit.prevent="updateDojo">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div v-if="isCityPlan" class="flex items-center rounded-md border border-primary/20 bg-primary/5 px-3 text-sm text-slate-600 dark:text-slate-300">City workspace location</div>
            <USelect
              v-else
              v-model="editDojoForm.nodeId"
              :items="editNodeOptions"
              placeholder="Choose the city or branch for this dojo"
              required
            />
            <UInput v-model="editDojoForm.name" placeholder="Dojo name" required />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <UInput v-model="editDojoForm.address" placeholder="Address" />
            <UInput v-model="editDojoForm.city" :readonly="isLocationFieldLocked(editDojoForm.nodeId, 'city')" placeholder="City" />
            <UInput v-model="editDojoForm.stateProvince" :readonly="isLocationFieldLocked(editDojoForm.nodeId, 'stateProvince')" placeholder="State / province" />
            <UInput v-model="editDojoForm.country" :readonly="isLocationFieldLocked(editDojoForm.nodeId, 'country')" placeholder="Country" />
            <p v-if="territoryMessage" class="md:col-span-3 text-sm text-slate-500 dark:text-slate-400">{{ territoryMessage }}</p>
            <UInput v-model="editDojoForm.phone" placeholder="Phone" />
            <UInput v-model="editDojoForm.email" placeholder="Email" />
            <USelect v-model="editDojoForm.defaultFeePlanId" :items="feePlanOptions" placeholder="Default fee plan (optional)" />
          </div>
          <div class="flex gap-2 mt-4">
            <UButton type="submit" :loading="updatingDojo">Update</UButton>
            <UButton type="button" color="neutral" @click="cancelEditDojo">Cancel</UButton>
          </div>
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
const { data: hierarchyPermissions } = await useFetch<{ managedParentNodeIds: number[] }>('/api/users/me/permissions')
const isFreePlan = computed(() => subscription.value?.plan !== 'city-starter' && subscription.value?.plan !== 'city-pro' && subscription.value?.plan !== 'state-pro' && subscription.value?.plan !== 'national')
const isCityStarter = computed(() => subscription.value?.plan === 'city-starter')
const canCreateDojo = computed(() => !!subscription.value && (!isFreePlan.value || dojos.value.length < 1) && (!isCityStarter.value || dojos.value.length < 2))
const isCityPlan = computed(() => ['city-starter', 'city-pro'].includes(subscription.value?.plan || ''))
const isStatePlan = computed(() => subscription.value?.plan === 'state-pro')
const isNationalPlan = computed(() => subscription.value?.plan === 'national')
const isAdvancedPlan = computed(() => ['state-pro', 'national'].includes(subscription.value?.plan || ''))
const needsAutomaticHierarchy = computed(() => isAdvancedPlan.value && nodeOptions.value.length === 0)
const dojos = ref<any[]>([])
const levels = ref<any[]>([])
const allNodes = ref<any[]>([])
const flatNodes = ref<any[]>([])
const instructors = ref<any[]>([])
const programs = ref<any[]>([])
const feePlans = ref<any[]>([])
const dojoInstructors = ref<Record<number, any[]>>({})
const schedules = ref<Record<number, any[]>>({})
const expandedDojoId = ref<number | null>(null)
const loadingSchedules = ref(false)

const creating = ref(false)
const updatingDojo = ref(false)
const addingSchedule = ref(false)
const updatingSchedule = ref(false)
const assigningInstructor = ref(false)

const territoryAnchor = computed(() => dojos.value[0] || null)
const territoryMessage = computed(() => {
  const territory = getLocationFromNode(newDojo.nodeId) || territoryAnchor.value
  if (!territory) return null
  const place = [territory.city, territory.stateProvince, territory.country].filter(Boolean).join(', ')
  if (place && newDojo.nodeId) return `City, state/province, and country are set by ${getNodePath(newDojo.nodeId)} and cannot be changed here.`
  if (isCityPlan.value && place) return `Locations in this plan must remain within ${place}.`
  if (isStatePlan.value && territory.stateProvince && territory.country) return `Locations in this plan must remain within ${territory.stateProvince}, ${territory.country}.`
  if (isNationalPlan.value && territory.country) return `Locations in this plan must remain within ${territory.country}.`
  return null
})

// ----- Form states -----
const newDojo = reactive({
  nodeId: null as number | null,
  name: '',
  programId: undefined as number | undefined,
  address: '',
  city: '',
  stateProvince: '',
  country: '',
  phone: '',
  email: '',
  defaultFeePlanId: null as number | null,
})

const editingDojo = ref<any>(null)
const editDojoForm = reactive({
  nodeId: null as number | null,
  name: '',
  address: '',
  city: '',
  stateProvince: '',
  country: '',
  phone: '',
  email: '',
})

type LocationFields = Pick<typeof newDojo, 'city' | 'stateProvince' | 'country'>
function getLocationFromNode(nodeId: number | null): Partial<LocationFields> | null {
  if (!nodeId) return null
  const nodesById = new Map(flatNodes.value.map(node => [Number(node.id), node]))
  const location: Partial<LocationFields> = {}
  let node = nodesById.get(Number(nodeId))
  let topLocation = node
  while (node) {
    const levelName = levels.value.find(level => Number(level.id) === Number(node.levelId))?.name?.trim().toLowerCase()
    if (levelName === 'city / town' && !location.city) location.city = node.name
    if (levelName === 'state / province' && !location.stateProvince) location.stateProvince = node.name
    if (levelName === 'country' && !location.country) location.country = node.name
    topLocation = node
    node = node.parentId ? nodesById.get(Number(node.parentId)) : undefined
  }
  // Some older National workspaces used their country as the top location
  // before a dedicated Country type existed. Preserve that valid structure.
  if (isNationalPlan.value && !location.country && topLocation) location.country = topLocation.name
  return Object.keys(location).length ? location : null
}

function isLocationFieldLocked(nodeId: number | null, field: keyof LocationFields) {
  return Boolean(getLocationFromNode(nodeId)?.[field])
}

function applyTerritoryDefaults(target: LocationFields = newDojo, nodeId: number | null = newDojo.nodeId) {
  const fromSelectedLocation = getLocationFromNode(nodeId)
  const anchor = territoryAnchor.value
  const city = fromSelectedLocation?.city || (isCityPlan.value ? anchor?.city : undefined)
  const stateProvince = fromSelectedLocation?.stateProvince || ((isCityPlan.value || isStatePlan.value) ? anchor?.stateProvince : undefined)
  const country = fromSelectedLocation?.country || ((isCityPlan.value || isStatePlan.value || isNationalPlan.value) ? anchor?.country : undefined)
  if (city) target.city = city
  if (stateProvince) target.stateProvince = stateProvince
  if (country) target.country = country
}

watch(() => newDojo.nodeId, nodeId => applyTerritoryDefaults(newDojo, nodeId))
watch(() => editDojoForm.nodeId, nodeId => {
  if (editingDojo.value) applyTerritoryDefaults(editDojoForm, nodeId)
})

watch([isCityPlan, isStatePlan, isNationalPlan, territoryAnchor], () => applyTerritoryDefaults())

const scheduleForm = reactive({
  dayOfWeek: undefined as number | undefined,  // ✅ changed from null
  startTime: '',
  endTime: '',
  name: '',
  programId: undefined as number | undefined,
  instructorId: undefined as number | undefined, // ✅ changed from null
})
const editingSchedule = ref<any>(null)
const editScheduleForm = reactive({
  dayOfWeek: undefined as number | undefined,
  startTime: '',
  endTime: '',
  name: '',
  instructorId: undefined as number | undefined,
})
// ----- Options -----
const dayOptions = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]

function instructorOptionsForDojo(dojoId: number) {
  return instructors.value
    .filter((user: any) => user.role === 'owner' || user.assignments?.some((assignment: any) => ['instructor', 'dojo_head'].includes(assignment.role) && assignment.scopeType === 'dojo' && Number(assignment.scopeId) === Number(dojoId)))
    .map((u: any) => ({
    label: u.name,
    value: u.id,
  }))
}

function scheduledInstructorOptions(dojoId: number) {
  return (dojoInstructors.value[dojoId] || [])
    .filter((assignment: any) => assignment.isActive)
    .map((assignment: any) => ({ label: assignment.user?.name || 'Instructor', value: assignment.userId }))
}
const dojoInstructorForm = reactive({ userId: undefined as number | undefined, programId: undefined as number | undefined, isPrimary: false })
const programOptions = computed(() => programs.value.map((program: any) => ({ label: program.displayName, value: program.id })))

// ----- Helper functions for hierarchy -----
function buildNodePathMap(nodesList: any[]) {
  const map: Record<number, any> = {}
  for (const node of nodesList) {
    map[node.id] = node
  }
  const pathMap: Record<number, string> = {}
  for (const node of nodesList) {
    const parts: string[] = []
    let current: any = node
    while (current) {
      // The API provides labels such as "Ahmedabad District" and
      // "Ahmedabad City" so repeated place names stay understandable.
      parts.unshift(current.label || current.name)
      if (current.parentId && map[current.parentId]) {
        current = map[current.parentId]
      } else {
        break
      }
    }
    pathMap[node.id] = parts.join(' → ')
  }
  return pathMap
}

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

const nodePathMap = ref<Record<number, string>>({})

function getNodePath(nodeId: number): string {
  return nodePathMap.value[nodeId] || 'Unknown'
}

const nodeOptions = computed(() => {
  return flatNodes.value.filter((node: any) => {
    if (!isAdvancedPlan.value) return true
    const level = levels.value.find((item: any) => Number(item.id) === Number(node.levelId))
    const isOperationalLocation = ['City / Town', 'Branch'].includes(level?.name)
    const isInsideManagedTerritory = user.value?.role === 'owner' || hierarchyPermissions.value?.managedParentNodeIds.includes(Number(node.id))
    return isOperationalLocation && isInsideManagedTerritory
  }).map((node: any) => ({
    label: getNodePath(node.id),
    value: node.id,
  }))
})
const editNodeOptions = computed(() => {
  const currentNodeId = editingDojo.value?.nodeId
  if (!currentNodeId || nodeOptions.value.some(option => Number(option.value) === Number(currentNodeId))) {
    return nodeOptions.value
  }

  // Operational dojos live on their own Dojo node. Keep that current value
  // visible in the edit form, while the other choices remain valid locations.
  return [{ label: getNodePath(currentNodeId), value: currentNodeId }, ...nodeOptions.value]
})
const feePlanOptions = computed(() => [{ label: 'No default fee plan', value: null }, ...feePlans.value.filter((plan: any) => plan.isActive).map((plan: any) => ({ label: plan.name, value: plan.id }))])

function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[day] || 'Unknown'
}

// ----- Load data -----
async function loadData() {
  try {
    const [dojosData, nodesData, levelsData, instructorsData, programsData, feePlansData] = await Promise.all([
      $fetch('/api/dojos'),
      $fetch('/api/hierarchy/nodes'),
      $fetch('/api/hierarchy/levels'),
      $fetch('/api/users'), // we'll filter instructors on frontend
      $fetch('/api/organization/programs'),
      $fetch('/api/fee-plans'),
    ])
    dojos.value = dojosData
    levels.value = levelsData
    allNodes.value = nodesData
    flatNodes.value = flattenTree(nodesData)
    nodePathMap.value = buildNodePathMap(flatNodes.value)
    applyTerritoryDefaults()
    programs.value = programsData
    feePlans.value = feePlansData

    // Filter users who can be instructors (owner, admin, instructor, dojo_head)
    instructors.value = instructorsData.filter((u: any) =>
      ['owner', 'admin'].includes(u.role) || u.assignments?.some((assignment: any) => ['instructor', 'dojo_head'].includes(assignment.role))
    )
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load data',
      description: error.data?.statusMessage || error.message,
    })
  }
}

// ----- Dojo CRUD -----
async function createDojo() {
  if ((!isCityPlan.value && !needsAutomaticHierarchy.value && !newDojo.nodeId) || !newDojo.name.trim()) {
    toast.add({ color: 'warning', title: (isCityPlan.value || needsAutomaticHierarchy.value) ? 'Dojo name is required' : 'Node and name are required' })
    return
  }

  creating.value = true
  try {
    await $fetch('/api/dojos', {
      method: 'POST',
      body: {
        nodeId: (isCityPlan.value || needsAutomaticHierarchy.value) ? undefined : newDojo.nodeId,
        name: newDojo.name.trim(),
        address: newDojo.address || undefined,
        city: newDojo.city || undefined,
        stateProvince: newDojo.stateProvince || undefined,
        country: newDojo.country || undefined,
        phone: newDojo.phone || undefined,
        email: newDojo.email || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Dojo created' })
    Object.assign(newDojo, { nodeId: null, name: '', address: '', city: '', stateProvince: '', country: '', phone: '', email: '' })
    applyTerritoryDefaults()
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Creation failed', description: error.data?.statusMessage || error.message })
  } finally {
    creating.value = false
  }
}

function startEdit(dojo: any) {
  editingDojo.value = dojo
  editDojoForm.nodeId = dojo.nodeId
  editDojoForm.name = dojo.name
  editDojoForm.address = dojo.address || ''
  editDojoForm.city = dojo.city || ''
  editDojoForm.stateProvince = dojo.stateProvince || ''
  editDojoForm.country = dojo.country || ''
  editDojoForm.phone = dojo.phone || ''
  editDojoForm.email = dojo.email || ''
  editDojoForm.defaultFeePlanId = dojo.defaultFeePlanId || null
  applyTerritoryDefaults(editDojoForm)
}

function cancelEditDojo() {
  editingDojo.value = null
}

async function updateDojo() {
  if (!editingDojo.value) return
  if (!editDojoForm.nodeId || !editDojoForm.name.trim()) {
    toast.add({ color: 'warning', title: 'Node and name are required' })
    return
  }

  updatingDojo.value = true
  try {
    await $fetch(`/api/dojos/${editingDojo.value.id}`, {
      method: 'PATCH',
      body: {
        nodeId: editDojoForm.nodeId,
        name: editDojoForm.name.trim(),
        address: editDojoForm.address || undefined,
        city: editDojoForm.city || undefined,
        stateProvince: editDojoForm.stateProvince || undefined,
        country: editDojoForm.country || undefined,
        phone: editDojoForm.phone || undefined,
        email: editDojoForm.email || undefined,
        defaultFeePlanId: editDojoForm.defaultFeePlanId,
      },
    })
    toast.add({ color: 'success', title: 'Dojo updated' })
    cancelEditDojo()
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Update failed', description: error.data?.statusMessage || error.message })
  } finally {
    updatingDojo.value = false
  }
}

async function deleteDojo(id: number) {
  if (!confirm('Delete this dojo? All associated schedules and students will be unlinked.')) return
  try {
    await $fetch(`/api/dojos/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Dojo deleted' })
    // Remove schedules cache for this dojo
    delete schedules.value[id]
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Deletion failed', description: error.data?.statusMessage || error.message })
  }
}

// ----- Schedule management -----
async function toggleSchedules(dojoId: number) {
  if (expandedDojoId.value === dojoId) {
    expandedDojoId.value = null
    return
  }
  expandedDojoId.value = dojoId
  // Fetch schedules if not already loaded
  if (!schedules.value[dojoId]) {
    loadingSchedules.value = true
    try {
      const data = await $fetch(`/api/dojos/${dojoId}/schedules`)
      schedules.value[dojoId] = data
    } catch (error: any) {
      toast.add({ color: 'error', title: 'Failed to load schedules', description: error.data?.statusMessage || error.message })
      schedules.value[dojoId] = []
    } finally {
      loadingSchedules.value = false
    }
  }
  if (!dojoInstructors.value[dojoId]) {
    try { dojoInstructors.value[dojoId] = await $fetch(`/api/dojos/${dojoId}/instructors`) } catch { dojoInstructors.value[dojoId] = [] }
  }
}

async function assignInstructor(dojoId: number) {
  if (!dojoInstructorForm.userId) { toast.add({ color: 'warning', title: 'Select an instructor' }); return }
  assigningInstructor.value = true
  try {
    await $fetch(`/api/dojos/${dojoId}/instructors`, { method: 'POST', body: { userId: dojoInstructorForm.userId, programId: dojoInstructorForm.programId || null, isPrimary: dojoInstructorForm.isPrimary } })
    dojoInstructors.value[dojoId] = await $fetch(`/api/dojos/${dojoId}/instructors`)
    Object.assign(dojoInstructorForm, { userId: undefined, programId: undefined, isPrimary: false })
    toast.add({ color: 'success', title: 'Instructor assigned to dojo' })
  } catch (error: any) { toast.add({ color: 'error', title: 'Could not assign instructor', description: error.data?.statusMessage || error.message }) } finally { assigningInstructor.value = false }
}

async function addSchedule(dojoId: number) {
  if (!scheduleForm.dayOfWeek || !scheduleForm.startTime || !scheduleForm.endTime || !scheduleForm.name.trim()) {
    toast.add({ color: 'warning', title: 'Please fill all required fields' })
    return
  }

  addingSchedule.value = true
  try {
    await $fetch(`/api/dojos/${dojoId}/schedules`, {
      method: 'POST',
      body: {
        dayOfWeek: scheduleForm.dayOfWeek,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        name: scheduleForm.name.trim(),
        programId: scheduleForm.programId || undefined,
        instructorId: scheduleForm.instructorId || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Schedule added' })
    // Reset form
    Object.assign(scheduleForm, { dayOfWeek: null, startTime: '', endTime: '', name: '', programId: null, instructorId: null })
    // Reload schedules
    const data = await $fetch(`/api/dojos/${dojoId}/schedules`)
    schedules.value[dojoId] = data
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to add schedule', description: error.data?.statusMessage || error.message })
  } finally {
    addingSchedule.value = false
  }
}

function startEditSchedule(sched: any) {
  editingSchedule.value = sched
  editScheduleForm.dayOfWeek = sched.dayOfWeek
  editScheduleForm.startTime = sched.startTime
  editScheduleForm.endTime = sched.endTime
  editScheduleForm.name = sched.name
  editScheduleForm.instructorId = sched.instructorId || null
}

function cancelEditSchedule() {
  editingSchedule.value = null
}

async function updateSchedule(dojoId: number) {
  if (!editingSchedule.value) return
  if (!editScheduleForm.dayOfWeek || !editScheduleForm.startTime || !editScheduleForm.endTime || !editScheduleForm.name.trim()) {
    toast.add({ color: 'warning', title: 'Please fill all required fields' })
    return
  }

  updatingSchedule.value = true
  try {
    await $fetch(`/api/dojos/${dojoId}/schedules/${editingSchedule.value.id}`, {
      method: 'PATCH',
      body: {
        dayOfWeek: editScheduleForm.dayOfWeek,
        startTime: editScheduleForm.startTime,
        endTime: editScheduleForm.endTime,
        name: editScheduleForm.name.trim(),
        instructorId: editScheduleForm.instructorId || null,
      },
    })
    toast.add({ color: 'success', title: 'Schedule updated' })
    cancelEditSchedule()
    // Reload schedules
    const data = await $fetch(`/api/dojos/${dojoId}/schedules`)
    schedules.value[dojoId] = data
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Update failed', description: error.data?.statusMessage || error.message })
  } finally {
    updatingSchedule.value = false
  }
}

async function deleteSchedule(dojoId: number, scheduleId: number) {
  if (!confirm('Delete this schedule?')) return
  try {
    await $fetch(`/api/dojos/${dojoId}/schedules/${scheduleId}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Schedule deleted' })
    // Reload schedules
    const data = await $fetch(`/api/dojos/${dojoId}/schedules`)
    schedules.value[dojoId] = data
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Deletion failed', description: error.data?.statusMessage || error.message })
  }
}

onMounted(loadData)
</script>
