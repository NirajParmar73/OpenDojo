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
        <div class="mt-4">
          <h4 class="font-medium mb-2">Guardians</h4>
          <div
            v-for="(g, idx) in newStudent.guardians"
            :key="idx"
            class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2 border p-2 rounded"
          >
            <UInput v-model="g.name" placeholder="Name" />
            <UInput v-model="g.relationship" placeholder="Relationship" />
            <UInput v-model="g.phone" placeholder="Phone" />
            <UInput v-model="g.email" type="email" placeholder="Email" />
            <div class="col-span-4">
              <UInput v-model="g.address" placeholder="Address" />
            </div>
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              @click="removeGuardian(newStudent.guardians, +idx)"
            >
              Remove
            </UButton>
          </div>
          <UButton size="sm" color="secondary" @click="addGuardian(newStudent.guardians)">
            Add Guardian
          </UButton>
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
          <tbody>
            <template v-for="student in students" :key="student.id">
              <!-- Main row -->
              <tr>
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
                    <NuxtLink :to="`/fees?id=${student.id}`">
                      <UButton color="secondary" variant="ghost" size="sm">Fees</UButton>
                    </NuxtLink>
                    <UButton color="error" variant="ghost" size="sm" @click="deleteStudent(student.id)">Archive</UButton>
                    <div class="flex items-center gap-1">
                      <UInput type="file" accept="image/*" :id="`avatar-${student.id}`" class="hidden" @change="(e) => uploadAvatar(student.id, e)" />
                      <UButton size="xs" color="secondary" @click="triggerFileInput(`avatar-${student.id}`)">Upload Avatar</UButton>
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Fees expanded row -->
              <tr v-if="expandedFeeStudentId === student.id">
                <td colspan="8" class="px-4 py-4 bg-gray-50">
                  <div class="space-y-4">
                    <div class="flex justify-between items-center">
                      <h4 class="text-md font-semibold">Fees for {{ student.firstName }} {{ student.lastName }}</h4>
                      <UButton color="neutral" variant="ghost" size="sm" @click="() => { expandedFeeStudentId = null }">Close</UButton>
                    </div>

                    <!-- Assignments Section -->
                    <div>
                      <h5 class="font-medium">Assignments</h5>
                      <form @submit.prevent="addFeeAssignment(student.id)" class="grid grid-cols-1 md:grid-cols-4 gap-2 my-2">
                        <USelect
                          v-model="newAssignment.feePlanId"
                          :items="feePlanOptions"
                          placeholder="Fee Plan"
                          required
                        />
                        <UInput v-model="newAssignment.startDate" type="date" required />
                        <UInput v-model.number="newAssignment.discount" type="number" placeholder="Discount" />
                        <UButton type="submit" :loading="addingAssignment">Assign</UButton>
                      </form>
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 text-sm">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="px-2 py-1 text-left">Plan</th>
                              <th class="px-2 py-1 text-left">Start</th>
                              <th class="px-2 py-1 text-left">Amount</th>
                              <th class="px-2 py-1 text-left">Discount</th>
                              <th class="px-2 py-1 text-left">Net</th>
                              <th class="px-2 py-1 text-left">Outstanding</th>
                              <th class="px-2 py-1 text-left">Status</th>
                              <th class="px-2 py-1 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="ass in feeAssignments[student.id] || []" :key="ass.id">
                              <td class="px-2 py-1">{{ ass.feePlan?.name }}</td>
                              <td class="px-2 py-1">{{ formatDate(ass.startDate) }}</td>
                              <td class="px-2 py-1">{{ formatCurrency(ass.feePlan?.amount || 0) }}</td>
                              <td class="px-2 py-1">{{ formatCurrency(ass.discount || 0) }}</td>
                              <td class="px-2 py-1">{{ formatCurrency(ass.netAmount || 0) }}</td>
                              <td class="px-2 py-1">{{ formatCurrency(ass.outstanding || 0) }}</td>
                              <td class="px-2 py-1">{{ ass.status }}</td>
                              <td class="px-2 py-1">
                                <UButton color="error" variant="ghost" size="xs" @click="deleteFeeAssignment(student.id, ass.id)">Delete</UButton>
                              </td>
                            </tr>
                            <tr v-if="(feeAssignments[student.id] || []).length === 0">
                              <td colspan="8" class="px-2 py-2 text-center text-gray-500">No assignments</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- Payments Section -->
                    <div>
                      <h5 class="font-medium">Payments</h5>
                      <form @submit.prevent="recordPayment(student.id)" class="grid grid-cols-1 md:grid-cols-5 gap-2 my-2">
                        <UInput v-model.number="paymentForm.amount" type="number" placeholder="Amount" required />
                        <UInput v-model="paymentForm.paymentDate" type="date" required />
                        <USelect
                          v-model="paymentForm.method"
                          :items="paymentMethods"
                          placeholder="Method"
                          required
                        />
                        <UInput v-model="paymentForm.referenceNumber" placeholder="Reference" />
                        <UButton type="submit" :loading="recordingPayment">Record</UButton>
                      </form>
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 text-sm">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="px-2 py-1 text-left">Receipt</th>
                              <th class="px-2 py-1 text-left">Date</th>
                              <th class="px-2 py-1 text-left">Amount</th>
                              <th class="px-2 py-1 text-left">Method</th>
                              <th class="px-2 py-1 text-left">Reference</th>
                              <th class="px-2 py-1 text-left">Receipt</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="pay in payments[student.id] || []" :key="pay.id">
                              <td class="px-2 py-1">{{ pay.receiptNumber }}</td>
                              <td class="px-2 py-1">{{ formatDate(pay.paymentDate) }}</td>
                              <td class="px-2 py-1">{{ formatCurrency(pay.amount) }}</td>
                              <td class="px-2 py-1">{{ pay.method }}</td>
                              <td class="px-2 py-1">{{ pay.referenceNumber || '-' }}</td>
                              <td class="px-2 py-1">
                                <UButton color="primary" variant="ghost" size="xs" @click="downloadReceipt(pay.id)">Receipt</UButton>
                              </td>
                            </tr>
                            <tr v-if="(payments[student.id] || []).length === 0">
                              <td colspan="6" class="px-2 py-2 text-center text-gray-500">No payments</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="students.length === 0">
              <td colspan="8" class="px-6 py-4 text-center text-gray-500">No students yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingStudent" class="mt-6 border-t pt-4">
        <!-- same as before – no changes -->
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
          <div class="mt-4">
            <h4 class="font-medium mb-2">Guardians</h4>
            <div
              v-for="(g, idx) in editForm.guardians"
              :key="idx"
              class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2 border p-2 rounded"
            >
              <UInput v-model="g.name" placeholder="Name" />
              <UInput v-model="g.relationship" placeholder="Relationship" />
              <UInput v-model="g.phone" placeholder="Phone" />
              <UInput v-model="g.email" type="email" placeholder="Email" />
              <div class="col-span-4">
                <UInput v-model="g.address" placeholder="Address" />
              </div>
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                @click="removeGuardian(editForm.guardians, +idx)"
              >
                Remove
              </UButton>
            </div>
            <UButton size="sm" color="secondary" @click="addGuardian(editForm.guardians)">
              Add Guardian
            </UButton>
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
const beltRanks = ref<any[]>([])
const creating = ref(false)
const updating = ref(false)

// Gender, status, etc.
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

const dojoOptions = computed(() =>
  dojos.value.map(d => ({ label: d.name, value: d.id }))
)
const beltOptions = computed(() =>
  beltRanks.value.map(r => ({ label: `${r.name} (${r.level})`, value: r.id }))
)

// ---- Student CRUD ----
const newStudent = reactive<any>({
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
  guardians: [],
})
const newStudentAvatarPreview = computed(() =>
  newStudent.avatarFile ? URL.createObjectURL(newStudent.avatarFile) : null
)

const editingStudent = ref<any>(null)
const editForm = reactive<any>({
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
  existingAvatar: null,
  guardians: [],
})
const editFormAvatarPreview = computed(() =>
  editForm.avatarFile ? URL.createObjectURL(editForm.avatarFile) : editForm.existingAvatar
)

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
    guardians: [],
  })
}

function addGuardian(arr: any[]) {
  arr.push({ name: '', relationship: '', phone: '', email: '', address: '' })
}
function removeGuardian(arr: any[], idx: number) {
  arr.splice(idx, 1)
}

function onNewAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement
  newStudent.avatarFile = target.files?.[0] || null
}
function onEditAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement
  editForm.avatarFile = target.files?.[0] || null
}

function triggerFileInput(id: string) {
  document.getElementById(id)?.click()
}

async function loadData() {
  try {
    const [studentsData, dojosData, beltsData] = await Promise.all([
      $fetch('/api/students'),
      $fetch('/api/dojos'),
      $fetch('/api/belt-ranks'),
    ])
    students.value = studentsData
    dojos.value = dojosData
    beltRanks.value = beltsData
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load data', description: error.message })
  }
}

async function createStudent() {
  if (!newStudent.firstName || !newStudent.lastName) {
    toast.add({ color: 'warning', title: 'First and last name are required' })
    return
  }
  creating.value = true
  try {
    let avatarUrl = null
    if (newStudent.avatarFile) {
      const fd = new FormData()
      fd.append('avatar', newStudent.avatarFile)
      const res = await $fetch('/api/upload', { method: 'POST', body: fd })
      avatarUrl = res.path
    }
    const studentRes = await $fetch('/api/students', {
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
    }) as any
    const studentId = studentRes.student.id

    // Create guardians
    for (const g of newStudent.guardians) {
      if (g.name && g.relationship) {
        await $fetch(`/api/students/${studentId}/guardians`, {
          method: 'POST',
          body: {
            name: g.name,
            relationship: g.relationship,
            phone: g.phone || undefined,
            email: g.email || undefined,
            address: g.address || undefined,
          },
        })
      }
    }
    toast.add({ color: 'success', title: 'Student created' })
    resetNewForm()
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Creation failed', description: error.data?.statusMessage || error.message })
  } finally {
    creating.value = false
  }
}

function startEdit(student: any) {
  editingStudent.value = student
  editForm.firstName = student.firstName ?? ''
  editForm.lastName = student.lastName ?? ''
  editForm.dojoId = student.dojoId ?? undefined
  editForm.email = student.email ?? ''
  editForm.phone = student.phone ?? ''
  editForm.dateOfBirth = student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : ''
  editForm.gender = student.gender ?? ''
  editForm.address = student.address ?? ''
  editForm.emergencyContact = student.emergencyContact ?? ''
  editForm.emergencyPhone = student.emergencyPhone ?? ''
  editForm.medicalNotes = student.medicalNotes ?? ''
  editForm.beltRankId = student.currentBeltRankId ?? undefined
  editForm.existingAvatar = student.avatar ?? null
  editForm.avatarFile = null
  editForm.guardians = student.guardians?.map((g: any) => ({ ...g })) || []
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
    // Replace guardians
    await $fetch(`/api/students/${editingStudent.value.id}/guardians`, { method: 'DELETE' })
    for (const g of editForm.guardians) {
      if (g.name && g.relationship) {
        await $fetch(`/api/students/${editingStudent.value.id}/guardians`, {
          method: 'POST',
          body: {
            name: g.name,
            relationship: g.relationship,
            phone: g.phone || undefined,
            email: g.email || undefined,
            address: g.address || undefined,
          },
        })
      }
    }
    toast.add({ color: 'success', title: 'Student updated' })
    cancelEdit()
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Update failed', description: error.data?.statusMessage || error.message })
  } finally {
    updating.value = false
  }
}

async function updateStatus(id: number, status: string) {
  try {
    await $fetch(`/api/students/${id}`, {
      method: 'PATCH',
      body: { status },
    })
    toast.add({ color: 'success', title: `Status updated to ${status}` })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Update failed', description: error.message })
  }
}

async function deleteStudent(id: number) {
  if (!confirm('Archive this student?')) return
  try {
    await $fetch(`/api/students/${id}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Student archived' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Archiving failed', description: error.message })
  }
}

async function uploadAvatar(studentId: number, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const fd = new FormData()
    fd.append('avatar', file)
    await $fetch(`/api/students/${studentId}/avatar`, { method: 'POST', body: fd })
    toast.add({ color: 'success', title: 'Avatar uploaded' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Upload failed', description: error.message })
  } finally {
    target.value = ''
  }
}

// ---- FEES (Inline) ----
const expandedFeeStudentId = ref<number | null>(null)
const feeAssignments = ref<Record<number, any[]>>({})
const payments = ref<Record<number, any[]>>({})
const feePlans = ref<any[]>([])

const feePlanOptions = computed(() =>
  feePlans.value.map(p => ({ label: `${p.name} (${formatCurrency(p.amount)})`, value: p.id }))
)

const newAssignment = reactive({
  feePlanId: undefined as number | undefined,
  startDate: '',
  discount: 0,
})
const addingAssignment = ref(false)

const paymentForm = reactive({
  amount: undefined as number | undefined,
  paymentDate: '',
  method: 'cash',
  referenceNumber: '',
})
const recordingPayment = ref(false)
const paymentMethods = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Card', value: 'card' },
  { label: 'Other', value: 'other' },
]

function formatCurrency(amount: number) {
  return `₹${(amount / 100).toFixed(2)}`
}
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString()
}

// Toggle expanded row
function toggleFees(studentId: number) {
  if (expandedFeeStudentId.value === studentId) {
    expandedFeeStudentId.value = null
  } else {
    expandedFeeStudentId.value = studentId
    loadFeeData(studentId)
  }
}

async function loadFeeData(studentId: number) {
  try {
    const [assignments, plans, paymentsData] = await Promise.all([
      $fetch(`/api/students/${studentId}/fee-assignments`),
      $fetch('/api/fee-plans'),
      $fetch(`/api/students/${studentId}/payments`),
    ]) as [any[], any[], any[]]

    feeAssignments.value[studentId] = assignments
    feePlans.value = plans
    payments.value[studentId] = paymentsData
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to load fee data', description: error.message })
  }
}

async function addFeeAssignment(studentId: number) {
  if (!newAssignment.feePlanId || !newAssignment.startDate) {
    toast.add({ color: 'warning', title: 'Fee plan and start date are required' })
    return
  }
  addingAssignment.value = true
  try {
    await $fetch(`/api/students/${studentId}/fee-assignments`, {
      method: 'POST' as any,
      body: {
        feePlanId: newAssignment.feePlanId,
        startDate: newAssignment.startDate,
        discount: newAssignment.discount ? Math.round(newAssignment.discount * 100) : 0,
      },
    })
    toast.add({ color: 'success', title: 'Assignment added' })
    await loadFeeData(studentId)
    // Reset form
    newAssignment.feePlanId = undefined
    newAssignment.startDate = ''
    newAssignment.discount = 0
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Failed to add assignment', description: error.message })
  } finally {
    addingAssignment.value = false
  }
}

async function deleteFeeAssignment(studentId: number, assignmentId: number) {
  if (!confirm('Delete this assignment? This cannot be undone if there are no payments.')) return
  try {
    await $fetch(`/api/students/${studentId}/fee-assignments/${assignmentId}`, { method: 'DELETE' })
    toast.add({ color: 'success', title: 'Assignment deleted' })
    await loadFeeData(studentId)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Deletion failed', description: error.message })
  }
}

async function recordPayment(studentId: number) {
  if (!paymentForm.amount || !paymentForm.paymentDate) {
    toast.add({ color: 'warning', title: 'Amount and date are required' })
    return
  }
  recordingPayment.value = true
  try {
    await $fetch(`/api/students/${studentId}/payments`, {
      method: 'POST' as any,
      body: {
        amount: Math.round(paymentForm.amount * 100),
        paymentDate: paymentForm.paymentDate,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
      },
    })
    toast.add({ color: 'success', title: 'Payment recorded' })
    await loadFeeData(studentId)
    // Reset form
    paymentForm.amount = undefined
    paymentForm.paymentDate = ''
    paymentForm.method = 'cash'
    paymentForm.referenceNumber = ''
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Payment failed', description: error.message })
  } finally {
    recordingPayment.value = false
  }
}

async function downloadReceipt(paymentId: number) {
  try {
    const response = await fetch(`/api/payments/${paymentId}/receipt`)
    if (!response.ok) throw new Error('Failed to generate receipt')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt_${paymentId}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Receipt download failed', description: error.message })
  }
}

onMounted(loadData)
</script>