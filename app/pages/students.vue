<template>
  <div class="max-w-7xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Student Management</h1>

    <!-- Create Student Form -->
    <UCard class="mb-6">
      <h3 class="text-lg font-semibold mb-3">Add Student</h3>
      <form @submit.prevent="createStudent">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UInput v-model="newStudent.firstName" placeholder="First Name" required />
          <UInput v-model="newStudent.lastName" placeholder="Last Name" required />
          <USelect
            v-model="newStudent.dojoId"
            :items="dojoOptions"
            placeholder="Select Dojo"
          />
          <UInput v-model="newStudent.email" type="email" placeholder="Email" />
          <UInput v-model="newStudent.phone" placeholder="Phone" />
          <UInput v-model="newStudent.dateOfBirth" type="date" placeholder="Date of Birth" />
          <USelect
            v-model="newStudent.gender"
            :items="genderOptions"
            placeholder="Gender"
          />
          <UInput v-model="newStudent.address" placeholder="Address" />
          <UInput v-model="newStudent.emergencyContact" placeholder="Emergency Contact" />
          <UInput v-model="newStudent.emergencyPhone" placeholder="Emergency Phone" />
          <UInput v-model="newStudent.medicalNotes" placeholder="Medical Notes" />
          <USelect
            v-model="newStudent.beltRankId"
            :items="beltOptions"
            placeholder="Select Belt"
          />
          <UInput type="file" accept="image/*" @change="onNewAvatarChange" />
          <img v-if="newStudentAvatarPreview" :src="newStudentAvatarPreview" class="h-16 w-16 object-cover rounded" />
        </div>
        <UButton type="submit" class="mt-4" :loading="creating">Add Student</UButton>
      </form>
    </UCard>

    <!-- Student List -->
    <UCard>
      <h2 class="text-lg font-semibold mb-4">Students</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avatar</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dojo</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Belt</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="student in students" :key="student.id">
              <td class="px-4 py-4">
                <img v-if="student.avatar" :src="student.avatar" class="h-10 w-10 rounded-full object-cover" />
                <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">No</div>
              </td>
              <td class="px-4 py-4">{{ student.firstName }} {{ student.lastName }}</td>
              <td class="px-4 py-4">{{ student.dojo?.name || 'None' }}</td>
              <td class="px-4 py-4">{{ student.currentBeltRank?.name || '-' }}</td>
              <td class="px-4 py-4">{{ student.email || '-' }}</td>
              <td class="px-4 py-4">{{ student.phone || '-' }}</td>
              <td class="px-4 py-4">
                <USelect
                  v-model="student.status"
                  :items="statusOptions"
                  @update:model-value="updateStatus(student.id, $event)"
                  variant="ghost"
                  size="sm"
                />
              </td>
              <td class="px-4 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                  <UButton color="primary" variant="ghost" size="sm" @click="startEdit(student)">Edit</UButton>
                  <UButton color="error" variant="ghost" size="sm" @click="deleteStudent(student.id)">Archive</UButton>
                </div>
              </td>
            </tr>
            <tr v-if="students.length === 0">
              <td colspan="8" class="px-6 py-4 text-center text-gray-500">No students yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingStudent" class="mt-6 border-t pt-4">
        <h3 class="text-lg font-semibold mb-3">Edit Student</h3>
        <form @submit.prevent="updateStudent">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UInput v-model="editForm.firstName" placeholder="First Name" required />
            <UInput v-model="editForm.lastName" placeholder="Last Name" required />
            <USelect
              v-model="editForm.dojoId"
              :items="dojoOptions"
              placeholder="Select Dojo"
            />
            <UInput v-model="editForm.email" type="email" placeholder="Email" />
            <UInput v-model="editForm.phone" placeholder="Phone" />
            <UInput v-model="editForm.dateOfBirth" type="date" placeholder="Date of Birth" />
            <USelect
              v-model="editForm.gender"
              :items="genderOptions"
              placeholder="Gender"
            />
            <UInput v-model="editForm.address" placeholder="Address" />
            <UInput v-model="editForm.emergencyContact" placeholder="Emergency Contact" />
            <UInput v-model="editForm.emergencyPhone" placeholder="Emergency Phone" />
            <UInput v-model="editForm.medicalNotes" placeholder="Medical Notes" />
            <USelect
              v-model="editForm.beltRankId"
              :items="beltOptions"
              placeholder="Select Belt"
            />
            <UInput type="file" accept="image/*" @change="onEditAvatarChange" />
            <img v-if="editFormAvatarPreview" :src="editFormAvatarPreview" class="h-16 w-16 object-cover rounded" />
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
const students = ref<any[]>([])
const dojos = ref<any[]>([])
const creating = ref(false)
const updating = ref(false)

const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
]
const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Archived', value: 'archived' },
]

const dojoOptions = computed(() => {
  return dojos.value.map((dojo: any) => ({
    label: dojo.name,
    value: dojo.id,
  }))
})

// Belt ranks
const beltRanks = ref<any[]>([])
const beltOptions = computed(() => {
  return beltRanks.value.map((r: any) => ({
    label: `${r.name} (${r.level})`,
    value: r.id,
  }))
})

// ----- New Student Form -----
const newStudent = reactive({
  firstName: '',
  lastName: '',
  dojoId: undefined as number | undefined,
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
  medicalNotes: '',
  beltRankId: undefined as number | undefined,
  avatarFile: null as File | null,
})

const newStudentAvatarPreview = computed(() => {
  return newStudent.avatarFile ? URL.createObjectURL(newStudent.avatarFile) : null
})

// ----- Edit Form -----
const editingStudent = ref<any>(null)
const editForm = reactive({
  firstName: '',
  lastName: '',
  dojoId: undefined as number | undefined,
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
  medicalNotes: '',
  beltRankId: undefined as number | undefined,
  avatarFile: null as File | null,
  existingAvatar: null as string | null,
})

const editFormAvatarPreview = computed(() => {
  if (editForm.avatarFile) {
    return URL.createObjectURL(editForm.avatarFile)
  }
  return editForm.existingAvatar || null
})

// ----- Load Data -----
async function loadData() {
  try {
    const [studentsData, dojosData, beltData] = await Promise.all([
      $fetch('/api/students'),
      $fetch('/api/dojos'),
      $fetch('/api/belt-ranks'),
    ])
    students.value = studentsData
    dojos.value = dojosData
    beltRanks.value = beltData
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load data',
      description: error.data?.statusMessage || error.message,
    })
  }
}

// ----- File Input Handlers -----
function onNewAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement
  newStudent.avatarFile = target.files?.[0] || null
}

function onEditAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement
  editForm.avatarFile = target.files?.[0] || null
}

// ----- Create Student -----
async function createStudent() {
  if (!newStudent.firstName || !newStudent.lastName) {
    toast.add({ color: 'warning', title: 'First and last name are required' })
    return
  }

  creating.value = true
  try {
    // Upload avatar if present
    let avatarUrl = null
    if (newStudent.avatarFile) {
      const fd = new FormData()
      fd.append('avatar', newStudent.avatarFile)
      const res = await $fetch('/api/upload', { method: 'POST', body: fd })
      avatarUrl = res.path
    }

    await $fetch('/api/students', {
      method: 'POST',
      body: {
        firstName: newStudent.firstName,
        lastName: newStudent.lastName,
        dojoId: newStudent.dojoId ?? null,
        email: newStudent.email || undefined,
        phone: newStudent.phone || undefined,
        dateOfBirth: newStudent.dateOfBirth || undefined,
        gender: newStudent.gender || undefined,
        address: newStudent.address || undefined,
        emergencyContact: newStudent.emergencyContact || undefined,
        emergencyPhone: newStudent.emergencyPhone || undefined,
        medicalNotes: newStudent.medicalNotes || undefined,
        avatar: avatarUrl,
        currentBeltRankId: newStudent.beltRankId ?? null,
      },
    })
    toast.add({ color: 'success', title: 'Student created' })
    resetNewForm()
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Creation failed', description: error.data?.statusMessage || error.message })
  } finally {
    creating.value = false
  }
}

function resetNewForm() {
  Object.assign(newStudent, {
    firstName: '',
    lastName: '',
    dojoId: undefined,
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalNotes: '',
    beltRankId: undefined,
    avatarFile: null,
  })
}

// ----- Edit Student -----
function startEdit(student: any) {
  editingStudent.value = student
  editForm.firstName = student.firstName ?? ''
  editForm.lastName = student.lastName ?? ''
  editForm.dojoId = student.dojoId ?? undefined
  editForm.email = student.email ?? ''
  editForm.phone = student.phone ?? ''
  editForm.dateOfBirth = (student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '') as string
  // editForm.dateOfBirth = student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : ''
  editForm.gender = student.gender ?? ''
  editForm.address = student.address ?? ''
  editForm.emergencyContact = student.emergencyContact ?? ''
  editForm.emergencyPhone = student.emergencyPhone ?? ''
  editForm.medicalNotes = student.medicalNotes ?? ''
  editForm.beltRankId = student.currentBeltRankId ?? undefined
  editForm.existingAvatar = student.avatar ?? null
  editForm.avatarFile = null
}

function cancelEdit() {
  editingStudent.value = null
}

async function updateStudent() {
  if (!editingStudent.value) return
  if (!editForm.firstName || !editForm.lastName) {
    toast.add({ color: 'warning', title: 'First and last name are required' })
    return
  }

  updating.value = true
  try {
    let avatarUrl = editForm.existingAvatar
    if (editForm.avatarFile) {
      const fd = new FormData()
      fd.append('avatar', editForm.avatarFile)
      const res = await $fetch('/api/upload', { method: 'POST', body: fd })
      avatarUrl = res.path
    }

    await $fetch(`/api/students/${editingStudent.value.id}`, {
      method: 'PATCH',
      body: {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        dojoId: editForm.dojoId ?? null,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
        gender: editForm.gender || undefined,
        address: editForm.address || undefined,
        emergencyContact: editForm.emergencyContact || undefined,
        emergencyPhone: editForm.emergencyPhone || undefined,
        medicalNotes: editForm.medicalNotes || undefined,
        avatar: avatarUrl,
        currentBeltRankId: editForm.beltRankId ?? null,
      },
    })
    toast.add({ color: 'success', title: 'Student updated' })
    cancelEdit()
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Update failed', description: error.data?.statusMessage || error.message })
  } finally {
    updating.value = false
  }
}

// ----- Status Update -----
async function updateStatus(studentId: number, newStatus: string) {
  try {
    await $fetch(`/api/students/${studentId}`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    toast.add({ color: 'success', title: `Status updated to ${newStatus}` })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Status update failed', description: error.data?.statusMessage || error.message })
  }
}

// ----- Delete (Archive) -----
async function deleteStudent(id: number) {
  if (!confirm('Archive this student?')) return
  try {
    await $fetch(`/api/students/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Student archived' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Archiving failed', description: error.data?.statusMessage || error.message })
  }
}

onMounted(loadData)
</script>