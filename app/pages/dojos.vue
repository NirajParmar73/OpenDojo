<template>
  <div class="max-w-5xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Dojo Management</h1>

    <!-- Create Dojo Form -->
    <UCard class="mb-6">
      <form @submit.prevent="createDojo">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <USelect
            v-model="newDojo.nodeId"
            :items="nodeOptions"
            placeholder="Select hierarchy node"
            required
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
                  <UButton color="error" variant="ghost" size="sm" @click="deleteDojo(dojo.id)">Delete</UButton>
                  <UButton color="secondary" variant="ghost" size="sm" @click="toggleSchedules(dojo.id)">
                    {{ expandedDojoId === dojo.id ? 'Hide Schedules' : 'Schedules' }}
                  </UButton>
                </td>
              </tr>

              <!-- Schedules row (expanded) -->
              <tr v-if="expandedDojoId === dojo.id">
                <td colspan="5" class="px-6 py-4 bg-gray-50">
                  <div class="pl-6">
                    <h4 class="font-medium mb-2">Schedules for {{ dojo.name }}</h4>

                    <!-- Add schedule form -->
                    <form @submit.prevent="addSchedule(dojo.id)" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                      <USelect
                        v-model="scheduleForm.dayOfWeek"
                        :items="dayOptions"
                        placeholder="Day"
                        required
                      />
                      <UInput v-model="scheduleForm.startTime" type="time" placeholder="Start" required />
                      <UInput v-model="scheduleForm.endTime" type="time" placeholder="End" required />
                      <UInput v-model="scheduleForm.name" placeholder="Class name" required />
                      <USelect
                        v-model="scheduleForm.instructorId"
                        :items="instructorOptions"
                        placeholder="Instructor (optional)"
                      />
                      <UButton type="submit" size="sm" :loading="addingSchedule">Add</UButton>
                    </form>

                    <!-- Schedule list -->
                    <div v-if="loadingSchedules" class="text-gray-500">Loading...</div>
                    <div v-else-if="schedules[dojo.id]?.length === 0" class="text-gray-500">No schedules yet.</div>
                    <div v-else>
                      <div v-for="sched in schedules[dojo.id]" :key="sched.id" class="flex items-center gap-4 border-b py-2">
                        <span class="w-20">{{ getDayName(sched.dayOfWeek) }}</span>
                        <span>{{ sched.startTime }} – {{ sched.endTime }}</span>
                        <span class="font-medium">{{ sched.name }}</span>
                        <span v-if="sched.instructor" class="text-sm text-gray-600">{{ sched.instructor.name }}</span>
                        <span v-else class="text-sm text-gray-400">No instructor</span>
                        <UButton color="primary" variant="ghost" size="xs" @click="startEditSchedule(sched)">Edit</UButton>
                        <UButton color="error" variant="ghost" size="xs" @click="deleteSchedule(dojo.id, sched.id)">Delete</UButton>
                      </div>
                    </div>

                    <!-- Inline edit schedule form -->
                    <div v-if="editingSchedule" class="mt-4 border-t pt-4">
                      <h5 class="font-medium mb-2">Edit Schedule</h5>
                      <form @submit.prevent="updateSchedule(dojo.id)" class="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <USelect
                          v-model="editScheduleForm.dayOfWeek"
                          :items="dayOptions"
                          placeholder="Day"
                          required
                        />
                        <UInput v-model="editScheduleForm.startTime" type="time" placeholder="Start" required />
                        <UInput v-model="editScheduleForm.endTime" type="time" placeholder="End" required />
                        <UInput v-model="editScheduleForm.name" placeholder="Class name" required />
                        <USelect
                          v-model="editScheduleForm.instructorId"
                          :items="instructorOptions"
                          placeholder="Instructor (optional)"
                        />
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
            <USelect
              v-model="editDojoForm.nodeId"
              :items="nodeOptions"
              placeholder="Select hierarchy node"
              required
            />
            <UInput v-model="editDojoForm.name" placeholder="Dojo name" required />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <UInput v-model="editDojoForm.address" placeholder="Address" />
            <UInput v-model="editDojoForm.phone" placeholder="Phone" />
            <UInput v-model="editDojoForm.email" placeholder="Email" />
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
const dojos = ref<any[]>([])
const allNodes = ref<any[]>([])
const flatNodes = ref<any[]>([])
const instructors = ref<any[]>([])
const schedules = ref<Record<number, any[]>>({})
const expandedDojoId = ref<number | null>(null)
const loadingSchedules = ref(false)

const creating = ref(false)
const updatingDojo = ref(false)
const addingSchedule = ref(false)
const updatingSchedule = ref(false)

// ----- Form states -----
const newDojo = reactive({
  nodeId: null as number | null,
  name: '',
  address: '',
  phone: '',
  email: '',
})

const editingDojo = ref<any>(null)
const editDojoForm = reactive({
  nodeId: null as number | null,
  name: '',
  address: '',
  phone: '',
  email: '',
})

const scheduleForm = reactive({
  dayOfWeek: undefined as number | undefined,  // ✅ changed from null
  startTime: '',
  endTime: '',
  name: '',
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

const instructorOptions = computed(() => {
  return instructors.value.map((u: any) => ({
    label: u.name,
    value: u.id,
  }))
})

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
      parts.unshift(current.name)
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
  return flatNodes.value.map((node: any) => ({
    label: getNodePath(node.id),
    value: node.id,
  }))
})

function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[day] || 'Unknown'
}

// ----- Load data -----
async function loadData() {
  try {
    const [dojosData, nodesData, instructorsData] = await Promise.all([
      $fetch('/api/dojos'),
      $fetch('/api/hierarchy/nodes'),
      $fetch('/api/users'), // we'll filter instructors on frontend
    ])
    dojos.value = dojosData
    allNodes.value = nodesData
    flatNodes.value = flattenTree(nodesData)
    nodePathMap.value = buildNodePathMap(flatNodes.value)

    // Filter users who can be instructors (owner, admin, instructor, dojo_head)
    instructors.value = instructorsData.filter((u: any) =>
      ['owner', 'admin', 'instructor', 'dojo_head'].includes(u.role)
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
  if (!newDojo.nodeId || !newDojo.name.trim()) {
    toast.add({ color: 'warning', title: 'Node and name are required' })
    return
  }

  creating.value = true
  try {
    await $fetch('/api/dojos', {
      method: 'POST',
      body: {
        nodeId: newDojo.nodeId,
        name: newDojo.name.trim(),
        address: newDojo.address || undefined,
        phone: newDojo.phone || undefined,
        email: newDojo.email || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Dojo created' })
    Object.assign(newDojo, { nodeId: null, name: '', address: '', phone: '', email: '' })
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
  editDojoForm.phone = dojo.phone || ''
  editDojoForm.email = dojo.email || ''
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
        phone: editDojoForm.phone || undefined,
        email: editDojoForm.email || undefined,
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
        instructorId: scheduleForm.instructorId || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Schedule added' })
    // Reset form
    Object.assign(scheduleForm, { dayOfWeek: null, startTime: '', endTime: '', name: '', instructorId: null })
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