<template>
  <div class="max-w-6xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Attendance</h1>

    <!-- Dojo Selector -->
    <UCard class="mb-6">
      <div class="flex items-center gap-4">
        <label class="font-medium">Select Dojo:</label>
        <USelect
          v-model="selectedDojoId"
          :items="dojoOptions"
          placeholder="Choose a dojo"
          @update:model-value="onDojoChange"
        />
      </div>
    </UCard>

    <!-- Create Session Form (auto‑filled from schedule) -->
    <UCard v-if="selectedDojoId" class="mb-6">
      <h3 class="text-lg font-semibold mb-3">Create Session</h3>
      <form @submit.prevent="createSession" class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <UInput v-model="newSessionDate" type="date" required />
        <USelect
          v-model="selectedScheduleId"
          :items="scheduleOptions"
          placeholder="Select schedule"
          @update:model-value="autoFillFromSchedule"
        />
        <UInput v-model="newSessionStart" type="time" placeholder="Start" required />
        <UInput v-model="newSessionEnd" type="time" placeholder="End" required />
        <UInput v-model="newSessionName" placeholder="Class name" />
        <USelect
          v-model="newSessionInstructorId"
          :items="instructorOptions"
          placeholder="Instructor"
        />
        <UButton type="submit" :loading="creatingSession" class="md:col-span-1">Create Session</UButton>
      </form>
    </UCard>

    <!-- Sessions List -->
    <UCard v-if="selectedDojoId">
      <h2 class="text-lg font-semibold mb-3">Sessions</h2>
      <div v-if="loadingSessions" class="text-gray-500">Loading...</div>
      <div v-else-if="sessions.length === 0" class="text-gray-500">No sessions found.</div>
      <div v-else>
        <div
          v-for="sess in sessions"
          :key="sess.id"
          class="border-b py-3 flex flex-wrap items-center gap-4 cursor-pointer hover:bg-gray-50"
          @click="() => selectSession(sess)"
        >
          <span class="font-medium">{{ formatDate(sess.date) }}</span>
          <span>{{ sess.startTime }} – {{ sess.endTime }}</span>
          <span class="text-gray-700">{{ sess.name || 'Class' }}</span>
          <span v-if="sess.instructor" class="text-sm text-gray-600">{{ sess.instructor.name }}</span>
          <span class="text-sm text-gray-500 ml-auto">
            {{ sess.stats?.present || 0 }} present / {{ sess.stats?.total || 0 }} total
          </span>
          <UButton size="xs" color="secondary" @click.stop="() => selectSession(sess)">Mark Attendance</UButton>
          <!-- Delete button -->
          <UButton size="xs" color="error" @click.stop="deleteSession(sess.id)">Delete</UButton>
        </div>
      </div>
    </UCard>

    <!-- Attendance Table -->
    <UCard v-if="selectedSession" class="mt-6">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-semibold">
          Attendance: {{ formatDate(selectedSession.date) }} – {{ selectedSession.name || 'Class' }}
        </h3>
        <div class="flex gap-2">
          <UButton size="sm" color="secondary" @click="markAllPresent">Mark All Present</UButton>
          <UButton color="neutral" size="sm" @click="() => { selectedSession = null; }">Close</UButton>
        </div>
      </div>
      <div v-if="loadingAttendance" class="text-gray-500">Loading attendance...</div>
      <div v-else>
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="item in attendanceItems" :key="item.studentId">
              <td class="px-4 py-2">{{ item.firstName }} {{ item.lastName }}</td>
              <td class="px-4 py-2">
                <USelect
                  v-model="item.status"
                  :items="statusOptions"
                  variant="ghost"
                  size="sm"
                />
              </td>
              <td class="px-4 py-2">
                <UInput v-model="item.notes" placeholder="Notes" size="sm" />
              </td>
            </tr>
          </tbody>
        </table>
        <UButton class="mt-4" @click="saveAttendance" :loading="savingAttendance">Save Attendance</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()

// State
const dojos = ref<any[]>([])
const schedules = ref<any[]>([])
const instructors = ref<any[]>([])
const selectedDojoId = ref<number | null>(null)
const sessions = ref<any[]>([])
const loadingSessions = ref(false)
const creatingSession = ref(false)

const selectedSession = ref<any>(null)
const attendanceItems = ref<any[]>([])
const loadingAttendance = ref(false)
const savingAttendance = ref(false)

// Session form fields
const newSessionDate = ref('')
const selectedScheduleId = ref<number | null>(null)
const newSessionStart = ref('')
const newSessionEnd = ref('')
const newSessionName = ref('')
const newSessionInstructorId = ref<number | null>(null)

// Options
const dojoOptions = computed(() =>
  dojos.value.map(d => ({ label: d.name, value: d.id }))
)
const scheduleOptions = computed(() =>
  schedules.value.map(s => ({
    label: `${getDayName(s.dayOfWeek)} ${s.startTime}–${s.endTime} ${s.name || ''}`,
    value: s.id,
  }))
)
const instructorOptions = computed(() =>
  instructors.value.map(u => ({ label: u.name, value: u.id }))
)
const statusOptions = [
  { label: 'Present', value: 'present' },
  { label: 'Absent', value: 'absent' },
  { label: 'Late', value: 'late' },
  { label: 'Excused', value: 'excused' },
  { label: 'Unmarked', value: 'unmarked' },
]

function getDayName(day: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[day] || ''
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString()
}

// Load data
async function loadDojosAndInstructors() {
  try {
    const [dojosData, usersData] = await Promise.all([
      $fetch('/api/dojos'),
      $fetch('/api/users'),
    ])
    dojos.value = dojosData
    instructors.value = usersData.filter((u: any) =>
      ['owner', 'admin', 'instructor', 'dojo_head'].includes(u.role)
    )
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load data', description: error.message })
  }
}

async function onDojoChange() {
  selectedScheduleId.value = null
  newSessionStart.value = ''
  newSessionEnd.value = ''
  newSessionName.value = ''
  newSessionInstructorId.value = null
  if (selectedDojoId.value) {
    try {
      schedules.value = await $fetch(`/api/dojos/${selectedDojoId.value}/schedules`)
    } catch (error: any) {
      toast.add({ color: 'error', title: 'Failed to load schedules', description: error.message })
    }
    await loadSessions()
  }
}

async function loadSessions() {
  if (!selectedDojoId.value) return
  loadingSessions.value = true
  try {
    sessions.value = await $fetch(`/api/dojos/${selectedDojoId.value}/sessions`)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load sessions', description: error.message })
  } finally {
    loadingSessions.value = false
  }
}

function autoFillFromSchedule() {
  if (!selectedScheduleId.value) return
  const schedule = schedules.value.find(s => s.id === selectedScheduleId.value)
  if (schedule) {
    newSessionStart.value = schedule.startTime
    newSessionEnd.value = schedule.endTime
    newSessionName.value = schedule.name || ''
    newSessionInstructorId.value = schedule.instructorId || null
  }
}

async function createSession() {
  if (!selectedDojoId.value || !newSessionDate.value || !newSessionStart.value || !newSessionEnd.value) {
    toast.add({ color: 'warning', title: 'Please fill all required fields' })
    return
  }
  creatingSession.value = true
  try {
    await $fetch(`/api/dojos/${selectedDojoId.value}/sessions`, {
      method: 'POST' as any,
      body: {
        date: newSessionDate.value,
        startTime: newSessionStart.value,
        endTime: newSessionEnd.value,
        name: newSessionName.value || undefined,
        instructorId: newSessionInstructorId.value || undefined,
        scheduleId: selectedScheduleId.value || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Session created' })
    newSessionDate.value = ''
    selectedScheduleId.value = null
    newSessionStart.value = ''
    newSessionEnd.value = ''
    newSessionName.value = ''
    newSessionInstructorId.value = null
    await loadSessions()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Creation failed', description: error.message })
  } finally {
    creatingSession.value = false
  }
}

async function selectSession(sess: any) {
  selectedSession.value = sess
  loadingAttendance.value = true
  try {
    const data = await $fetch(`/api/sessions/${sess.id}/attendance`) as any
    attendanceItems.value = data.attendance
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load attendance', description: error.message })
  } finally {
    loadingAttendance.value = false
  }
}

function markAllPresent() {
  if (!confirm('Set all students to Present?')) return
  attendanceItems.value.forEach(item => {
    item.status = 'present'
  })
}

async function saveAttendance() {
  if (!selectedSession.value) return
  savingAttendance.value = true
  try {
    await $fetch(`/api/sessions/${selectedSession.value.id}/attendance`, {
      method: 'POST' as any,
      body: {
        items: attendanceItems.value.map(item => ({
          studentId: item.studentId,
          status: item.status,
          notes: item.notes || undefined,
          attendanceId: item.attendanceId,
        })),
      },
    })
    toast.add({ color: 'success', title: 'Attendance saved' })
    await loadSessions()
    await selectSession(selectedSession.value)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to save', description: error.message })
  } finally {
    savingAttendance.value = false
  }
}

// ✅ Delete session
async function deleteSession(sessionId: number) {
  if (!confirm('Delete this session? All attendance records will also be removed.')) return
  try {
    await $fetch(`/api/dojos/${selectedDojoId.value}/sessions/${sessionId}`, {
      method: 'DELETE' as any,
    })
    toast.add({ color: 'success', title: 'Session deleted' })
    await loadSessions()
    if (selectedSession.value && selectedSession.value.id === sessionId) {
      selectedSession.value = null
      attendanceItems.value = []
    }
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Deletion failed', description: error.message })
  }
}

onMounted(loadDojosAndInstructors)
</script>