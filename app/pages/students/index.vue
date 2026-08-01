<template>
  <div class="mx-auto max-w-7xl">
    <section class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm font-semibold text-primary">PEOPLE</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Student directory</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Find students quickly, update essential details, and open their full record.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton to="/students/import" color="neutral" variant="outline" icon="i-lucide-file-spreadsheet" size="lg">Import CSV</UButton>
        <UButton color="primary" icon="i-lucide-user-plus" size="lg" :disabled="studentLimitReached" @click="toggleCreateForm">
          {{ studentLimitReached ? 'Student limit reached' : (showCreate ? 'Close form' : 'Add student') }}
        </UButton>
      </div>
    </section>

    <UAlert v-if="studentLimitReached" class="mb-6" color="warning" title="Student limit reached" :description="studentLimitMessage" :actions="[{ label: 'View upgrade options', to: '/settings/subscription', color: 'primary' }]" />

    <UCard v-if="showCreate" class="mb-6">
      <template #header><div><h3 class="font-semibold">Add a student</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Start with the essentials, including an optional fee plan and recurring discount. You can update fee terms later from the student profile.</p></div></template>
      <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" @submit.prevent="createStudent">
        <UFormField label="First name" required><UInput v-model="newStudent.firstName" required /></UFormField>
        <UFormField label="Last name" required><UInput v-model="newStudent.lastName" required /></UFormField>
        <UFormField label="Dojo" required><USelect v-model="newStudent.dojoId" :items="dojoOptions" placeholder="Select a dojo" required /></UFormField>
        <UFormField label="Program"><USelect v-model="newStudent.programId" :items="programOptions" placeholder="Optional - choose a martial art or fitness program" /></UFormField>
        <UFormField label="Email address"><UInput v-model="newStudent.email" type="email" /></UFormField>
        <UFormField label="Phone number"><UInput v-model="newStudent.phone" /></UFormField>
        <UFormField label="Date of birth">
          <UInput v-model="newStudent.dateOfBirth" type="date" />
        </UFormField>
        <UFormField label="Date joined" required>
          <UInput v-model="newStudent.joinedAt" type="date" required />
        </UFormField>
        <UCheckbox v-if="newStudent.dojoId" v-model="newStudent.assignFeePlan" label="Set fee plan now" class="self-end" />
        <UFormField v-if="newStudent.dojoId && newStudent.assignFeePlan" label="Fee plan" required><USelect v-model="newStudent.feePlanId" :items="availableFeePlanOptions" placeholder="Select a fee plan" required /></UFormField>
        <UFormField v-if="newStudent.dojoId && newStudent.assignFeePlan" label="Recurring discount"><UInput v-model.number="newStudent.initialDiscount" type="number" min="0" step="0.01" placeholder="0.00" /></UFormField>
        <UFormField v-if="newStudent.dojoId && newStudent.assignFeePlan && newStudent.initialDiscount" label="Discount reason" required><UInput v-model="newStudent.discountReason" placeholder="e.g. Sibling discount" required /></UFormField>
        <UFormField label="Gender"><USelect v-model="newStudent.gender" :items="genderOptions" placeholder="Optional" /></UFormField>
        <UFormField label="Emergency contact"><UInput v-model="newStudent.emergencyContact" /></UFormField>
        <UFormField label="Emergency phone"><UInput v-model="newStudent.emergencyPhone" /></UFormField>
        <UFormField label="Profile photo" description="Optional. JPG, PNG, GIF, or WebP up to 5 MB.">
          <div class="flex items-center gap-3">
            <img v-if="studentAvatarPreview" :src="studentAvatarPreview" alt="Selected profile photo" class="h-12 w-12 rounded-full object-cover" />
            <input ref="studentCameraInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" class="hidden" @change="selectStudentAvatar" />
            <input ref="studentGalleryInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" @change="selectStudentAvatar" />
            <div class="flex flex-wrap gap-2">
              <UButton type="button" size="sm" color="neutral" variant="soft" icon="i-lucide-camera" @click="studentCameraInput?.click()">Take photo</UButton>
              <UButton type="button" size="sm" color="neutral" variant="soft" icon="i-lucide-image" @click="studentGalleryInput?.click()">Choose photo</UButton>
            </div>
          </div>
        </UFormField>
        <UFormField label="Address" class="md:col-span-2"><UInput v-model="newStudent.address" placeholder="Street address (optional)" /></UFormField>
        <UFormField label="Country"><UInput v-model="newStudent.country" placeholder="e.g. Canada" /></UFormField>
        <UFormField label="Country code"><UInput v-model="newStudent.countryCode" maxlength="2" placeholder="CA" /></UFormField>
        <UFormField label="State / province"><UInput v-model="newStudent.stateProvince" /></UFormField>
        <UFormField label="City"><UInput v-model="newStudent.city" /></UFormField>
        <UFormField label="Postal / ZIP code"><UInput v-model="newStudent.postalCode" /></UFormField>
        <div class="md:col-span-2 xl:col-span-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <UCheckbox v-model="newStudent.grantPortalAccess" label="Grant student portal access now" />
          <p class="mt-2 text-xs text-slate-500">A unique username and one-time temporary password will be generated.</p>
        </div>
        <div class="md:col-span-2 xl:col-span-3 flex flex-wrap justify-end gap-2 pt-2">
          <UButton type="button" color="neutral" variant="ghost" @click="resetCreateForm">Cancel</UButton>
          <UButton type="submit" color="primary" :loading="creating">Create student</UButton>
        </div>
      </form>
    </UCard>

    <UCard v-if="portalCredentials.length" class="mb-6">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><h3 class="font-semibold">Portal credentials</h3><p class="mt-1 text-sm text-slate-500">Copy or download these temporary passwords now. They cannot be viewed again.</p></div>
          <UButton color="neutral" variant="outline" icon="i-lucide-download" @click="downloadCredentials">Download CSV</UButton>
        </div>
      </template>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400"><tr><th class="px-3 py-2">Student</th><th class="px-3 py-2">Username</th><th class="px-3 py-2">Temporary password</th></tr></thead>
          <tbody><tr v-for="credential in portalCredentials" :key="credential.studentId" class="border-t border-slate-100 dark:border-slate-800"><td class="px-3 py-3">{{ credential.studentName }}</td><td class="px-3 py-3 font-mono">{{ credential.username }}</td><td class="px-3 py-3 font-mono">{{ credential.temporaryPassword }}</td></tr></tbody>
        </table>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="font-semibold">All students</h3>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ filteredStudents.length }} of {{ students.length }} students shown</p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <UInput v-model="search" icon="i-lucide-search" placeholder="Search name, email, or phone" class="w-full sm:w-72" />
            <USelect v-model="dojoFilter" :items="dojoFilterOptions" placeholder="All dojos" aria-label="Filter students by dojo" class="w-full sm:w-48" />
            <USelect v-model="statusFilter" :items="statusFilterOptions" class="w-full sm:w-36" />
          </div>
        </div>
      </template>

      <div v-if="selectedStudentIds.length" class="mb-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-medium">{{ selectedStudentIds.length }} student{{ selectedStudentIds.length === 1 ? '' : 's' }} selected</p>
        <div class="flex flex-wrap gap-2">
          <UButton size="sm" :loading="bulkUpdating" icon="i-lucide-key-round" @click="runBulkPortalAction('grant')">Grant access</UButton>
          <UButton size="sm" color="neutral" variant="soft" :loading="bulkUpdating" @click="runBulkPortalAction('activate')">Activate</UButton>
          <UButton size="sm" color="neutral" variant="soft" :loading="bulkUpdating" @click="runBulkPortalAction('deactivate')">Deactivate</UButton>
          <UButton size="sm" color="warning" variant="soft" :loading="bulkUpdating" @click="runBulkPortalAction('reset')">Reset passwords</UButton>
          <UButton size="sm" color="neutral" variant="ghost" @click="selectedStudentIds = []">Clear</UButton>
        </div>
      </div>

      <div v-if="loading" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="index in 6" :key="index" class="h-32 rounded-2xl" />
      </div>

      <UAlert v-else-if="loadError" color="error" title="Could not load students" :description="loadError" />

      <template v-else>
        <div class="grid gap-3 md:hidden">
          <article v-for="student in filteredStudents" :key="student.id" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div class="flex items-start gap-3">
              <UCheckbox :model-value="selectedStudentIds.includes(student.id)" :aria-label="`Select ${student.firstName} ${student.lastName}`" @update:model-value="toggleStudentSelection(student.id, $event)" />
              <StudentAvatar :student="student" />
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <NuxtLink :to="`/students/${student.id}`" class="truncate font-semibold hover:text-primary">{{ student.firstName }} {{ student.lastName }}</NuxtLink>
                  <UBadge :color="student.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="shrink-0 capitalize">{{ student.status }}</UBadge>
                </div>
                <p class="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{{ student.dojo?.name || 'No dojo assigned' }}</p>
                <p class="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{{ student.email || student.phone || 'No contact details' }}</p>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Born: {{ formatDate(student.dateOfBirth) }}<span v-if="student.dateOfBirth"> · {{ ageLabel(student.dateOfBirth) }}</span></p>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Joined: {{ formatDate(student.joinedAt) }}</p>
                <UBadge class="mt-2" :color="portalAccount(student)?.isActive ? 'success' : 'neutral'" variant="subtle">{{ portalAccount(student) ? (portalAccount(student)?.isActive ? 'Portal active' : 'Portal inactive') : 'No portal access' }}</UBadge>
              </div>
            </div>
            <div class="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <UButton :to="`/fees?id=${student.id}`" size="sm" color="primary" variant="soft">Record fee</UButton>
              <UButton :to="`/students/${student.id}`" size="sm" color="neutral" variant="ghost">Profile</UButton>
              <UButton :to="`/students/${student.id}/edit`" size="sm" color="neutral" variant="ghost">Edit</UButton>
              <UButton size="sm" color="error" variant="ghost" @click="archiveStudent(student)">Archive</UButton>
            </div>
          </article>
        </div>

        <div class="hidden overflow-x-auto md:block">
          <table class="min-w-[1120px] text-sm">
            <thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr><th class="px-3 py-3"><UCheckbox :model-value="allFilteredSelected" aria-label="Select all shown students" @update:model-value="toggleAllFiltered($event)" /></th><th class="sticky left-0 z-20 bg-slate-50 px-3 py-3 shadow-[2px_0_4px_-3px_rgba(15,23,42,0.45)] dark:bg-slate-950">Student</th><th class="px-3 py-3">Dojo</th><th class="px-3 py-3">Rank</th><th class="px-3 py-3">Contact</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Portal</th><th class="px-3 py-3">Date of birth / age</th><th class="px-3 py-3">Date joined</th><th class="px-3 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              <tr v-for="student in filteredStudents" :key="student.id" class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td class="px-3 py-4"><UCheckbox :model-value="selectedStudentIds.includes(student.id)" :aria-label="`Select ${student.firstName} ${student.lastName}`" @update:model-value="toggleStudentSelection(student.id, $event)" /></td>
                <td class="sticky left-0 z-10 bg-white px-3 py-4 shadow-[2px_0_4px_-3px_rgba(15,23,42,0.45)] dark:bg-slate-900"><div class="flex items-center gap-3"><StudentAvatar :student="student" size="sm" /><NuxtLink :to="`/students/${student.id}`" class="font-medium hover:text-primary">{{ student.firstName }} {{ student.lastName }}</NuxtLink></div></td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ student.dojo?.name || '—' }}</td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ student.currentBeltRank?.name || '—' }}</td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300"><p>{{ student.email || '—' }}</p><p class="mt-1 text-xs text-slate-400">{{ student.phone || '' }}</p></td>
                <td class="px-3 py-4"><UBadge :color="student.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="capitalize">{{ student.status }}</UBadge></td>
                <td class="px-3 py-4"><UBadge :color="portalAccount(student)?.isActive ? 'success' : 'neutral'" variant="subtle">{{ portalAccount(student) ? (portalAccount(student)?.isActive ? 'Active' : 'Inactive') : 'Not granted' }}</UBadge></td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300"><p>{{ formatDate(student.dateOfBirth) }}</p><p v-if="student.dateOfBirth" class="mt-1 text-xs text-slate-400">{{ ageLabel(student.dateOfBirth) }}</p></td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ formatDate(student.joinedAt) }}</td>
                <td class="px-3 py-4"><div class="flex justify-end gap-1"><UButton :to="`/fees?id=${student.id}`" size="xs" color="primary" variant="soft">Record fee</UButton><UButton :to="`/students/${student.id}`" size="xs" color="neutral" variant="ghost">Profile</UButton><UButton :to="`/students/${student.id}/edit`" size="xs" color="neutral" variant="ghost">Edit</UButton><UButton size="xs" color="error" variant="ghost" @click="archiveStudent(student)">Archive</UButton></div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState v-if="!filteredStudents.length" roomy icon="i-lucide-users-round" :message="students.length ? 'No students match your search or filter.' : 'Add your first student to begin managing your dojo.'" />
      </template>
    </UCard>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
type Subscription = { plan: string, limits: { students: number | null, studentsPerDojo: number | null }, usage: { students: number } }
const { data: subscription } = await useFetch<Subscription>('/api/organization/subscription')
type FeePlan = { id: number, name: string, dojoId: number | null, isActive: number | null, frequency: string | null, amount: number, dojo?: { name: string } | null }
const students = ref<any[]>([])
const dojos = ref<any[]>([])
const feePlans = ref<FeePlan[]>([])
const programs = ref<any[]>([])
const loading = ref(true)
const loadError = ref('')
const creating = ref(false)
const bulkUpdating = ref(false)
const showCreate = ref(false)
const selectedStudentIds = ref<number[]>([])
type PortalCredential = { studentId: number, studentName: string, username: string, temporaryPassword: string }
const portalCredentials = ref<PortalCredential[]>([])
const search = ref('')
const dojoFilter = ref<number | 'all'>('all')
const statusFilter = ref('all')

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Archived', value: 'archived' },
]
const statusFilterOptions = [{ label: 'All statuses', value: 'all' }, ...statusOptions]
const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
]

const today = new Date().toISOString().slice(0, 10)
const newStudent = reactive({ firstName: '', lastName: '', dojoId: null as number | null, programId: null as number | null, email: '', phone: '', dateOfBirth: '', joinedAt: today, assignFeePlan: true, feePlanId: undefined as number | undefined, initialDiscount: 0, discountReason: '', gender: undefined as string | undefined, emergencyContact: '', emergencyPhone: '', address: '', city: '', stateProvince: '', country: '', countryCode: '', postalCode: '', grantPortalAccess: true })
const studentAvatarFile = ref<File | null>(null)
const studentAvatarPreview = ref('')
const studentCameraInput = ref<HTMLInputElement | null>(null)
const studentGalleryInput = ref<HTMLInputElement | null>(null)

const globalStudentLimitReached = computed(() => {
  const limit = subscription.value?.limits.students
  return limit !== null && limit !== undefined && students.value.length >= limit
})
const studentLimitReached = computed(() => globalStudentLimitReached.value)
const studentLimitMessage = computed(() => `Your plan includes up to ${subscription.value?.limits.students} students. Upgrade to continue enrolling students.`)
const dojoOptions = computed(() => dojos.value.map(dojo => ({ label: dojo.name, value: dojo.id })))
const programOptions = computed(() => programs.value.map(program => ({ label: program.displayName, value: program.id })))
const feeFrequencyLabel = (frequency?: string | null) => ({ monthly: 'every month', quarterly: 'every 3 months', annual: 'every year', 'one-time': 'one-time' } as Record<string, string>)[frequency || ''] || 'billing period'
const availableFeePlanOptions = computed(() => feePlans.value
  .filter(plan => !plan.dojoId || plan.dojoId === newStudent.dojoId)
  .filter(plan => plan.isActive)
  .map(plan => ({ ...plan, name: `${plan.name} - ${feeFrequencyLabel(plan.frequency)} - ${Number(plan.amount || 0) / 100} per charge` }))
  .map(plan => ({ label: `${plan.name}${plan.dojo?.name ? ` — ${plan.dojo.name}` : ''}`, value: plan.id })))
const dojoFilterOptions = computed(() => [{ label: 'All dojos', value: 'all' }, ...dojoOptions.value])
const filteredStudents = computed(() => {
  const query = search.value.trim().toLowerCase()
  return students.value.filter((student) => {
    const matchesStatus = statusFilter.value === 'all' || student.status === statusFilter.value
    const matchesDojo = dojoFilter.value === 'all' || student.dojoId === dojoFilter.value
    const haystack = `${student.firstName} ${student.lastName} ${student.email || ''} ${student.phone || ''}`.toLowerCase()
    return matchesStatus && matchesDojo && (!query || haystack.includes(query))
  })
})
const allFilteredSelected = computed(() => filteredStudents.value.length > 0 && filteredStudents.value.every(student => selectedStudentIds.value.includes(student.id)))
const portalAccount = (student: any) => student.portalAccounts?.[0]

function resetCreateForm() {
  if (studentAvatarPreview.value) URL.revokeObjectURL(studentAvatarPreview.value)
  studentAvatarFile.value = null
  studentAvatarPreview.value = ''
  const grantPortalAccess = newStudent.grantPortalAccess
  Object.assign(newStudent, { firstName: '', lastName: '', dojoId: null, programId: null, email: '', phone: '', dateOfBirth: '', joinedAt: new Date().toISOString().slice(0, 10), assignFeePlan: true, feePlanId: undefined, initialDiscount: 0, discountReason: '', gender: undefined, emergencyContact: '', emergencyPhone: '', address: '', city: '', stateProvince: '', country: '', countryCode: '', postalCode: '', grantPortalAccess })
  showCreate.value = false
}

function selectStudentAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    input.value = ''
    toast.add({ color: 'warning', title: 'Choose an image up to 5 MB' })
    return
  }
  if (studentAvatarPreview.value) URL.revokeObjectURL(studentAvatarPreview.value)
  studentAvatarFile.value = file
  studentAvatarPreview.value = URL.createObjectURL(file)
  input.value = ''
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function ageLabel(dateOfBirth: string) {
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear()
  const birthdayHasPassed = today.getUTCMonth() > birthDate.getUTCMonth()
    || (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate())
  if (!birthdayHasPassed) age -= 1
  return `${Math.max(0, age)} years old`
}

async function toggleCreateForm() {
  if (studentLimitReached.value) return
  if (!showCreate.value && !dojos.value.length) {
    toast.add({ color: 'warning', title: 'Create a dojo before adding students', description: 'Set up your dojo, fees, instructor, and schedule first.' })
    await navigateTo('/dojos')
    return
  }
  showCreate.value = !showCreate.value
}

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const [studentData, dojoData, feePlanData, programData, organizationSettings] = await Promise.all([$fetch('/api/students'), $fetch('/api/dojos'), $fetch('/api/fee-plans'), $fetch('/api/organization/programs'), $fetch('/api/organization/settings')])
    students.value = studentData as any[]
    dojos.value = dojoData as any[]
    feePlans.value = feePlanData as unknown as FeePlan[]
    programs.value = programData as any[]
    newStudent.grantPortalAccess = (organizationSettings as any).autoGrantStudentPortalAccess ?? true
  } catch (error: any) {
    loadError.value = error.data?.statusMessage || error.message || 'Please try again.'
  } finally {
    loading.value = false
  }
}

async function createStudent() {
  if (!newStudent.dojoId) {
    toast.add({ color: 'warning', title: 'Select a dojo before creating a student' })
    return
  }
  if (newStudent.assignFeePlan && newStudent.dojoId && !newStudent.feePlanId) {
    toast.add({ color: 'warning', title: 'Select a fee plan or turn off fee setup' })
    return
  }
  creating.value = true
  try {
    const response = await $fetch('/api/students', {
      method: 'POST',
      body: { ...newStudent, feePlanId: newStudent.assignFeePlan ? newStudent.feePlanId : null, initialDiscount: Math.round((newStudent.initialDiscount || 0) * 100), discountReason: newStudent.discountReason || undefined, email: newStudent.email || null, phone: newStudent.phone || null, dateOfBirth: newStudent.dateOfBirth || null, gender: newStudent.gender || null, emergencyContact: newStudent.emergencyContact || null, emergencyPhone: newStudent.emergencyPhone || null, address: newStudent.address || null, city: newStudent.city || null, stateProvince: newStudent.stateProvince || null, country: newStudent.country || null, countryCode: newStudent.countryCode || null, postalCode: newStudent.postalCode || null },
    }) as any
    if (studentAvatarFile.value) {
      try {
        const formData = new FormData()
        formData.append('avatar', studentAvatarFile.value)
        const avatar = await $fetch<{ path: string }>(`/api/students/${response.student.id}/avatar`, { method: 'POST', body: formData })
        response.student.avatar = avatar.path
      } catch (error: any) {
        toast.add({ color: 'warning', title: 'Student created, but photo was not uploaded', description: error.data?.statusMessage || error.message })
      }
    }
    students.value.unshift(response.student)
    if (response.portalCredentials) portalCredentials.value = [response.portalCredentials]
    resetCreateForm()
    toast.add({ color: 'success', title: 'Student created' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not create student', description: error.data?.statusMessage || error.message })
  } finally {
    creating.value = false
  }
}

function toggleStudentSelection(studentId: number, selected: boolean | 'indeterminate') {
  selectedStudentIds.value = selected
    ? [...new Set([...selectedStudentIds.value, studentId])]
    : selectedStudentIds.value.filter(id => id !== studentId)
}

function toggleAllFiltered(selected: boolean | 'indeterminate') {
  const visibleIds = filteredStudents.value.map(student => student.id)
  selectedStudentIds.value = selected
    ? [...new Set([...selectedStudentIds.value, ...visibleIds])]
    : selectedStudentIds.value.filter(id => !visibleIds.includes(id))
}

async function runBulkPortalAction(action: 'grant' | 'activate' | 'deactivate' | 'reset') {
  if (!selectedStudentIds.value.length) return
  if (action === 'reset' && !confirm(`Reset portal passwords for ${selectedStudentIds.value.length} selected students? Their current passwords will stop working.`)) return
  bulkUpdating.value = true
  try {
    const result = await $fetch<any>('/api/students/portal-accounts/bulk', {
      method: 'POST',
      body: { studentIds: selectedStudentIds.value, action },
    })
    portalCredentials.value = result.credentials || []
    await loadData()
    selectedStudentIds.value = []
    toast.add({
      color: 'success',
      title: `Portal access ${action === 'grant' ? 'granted' : action === 'reset' ? 'reset' : `${action}d`}`,
      description: portalCredentials.value.length ? 'Download the temporary credentials now; they cannot be viewed again.' : `${result.affected} students processed.`,
    })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not update portal access', description: error.data?.statusMessage || error.message })
  } finally {
    bulkUpdating.value = false
  }
}

function csvCell(value: unknown) {
  const original = String(value ?? '')
  const safe = /^[=+\-@]/.test(original) ? `'${original}` : original
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function downloadCredentials() {
  const rows = [
    ['Student', 'Username', 'Temporary Password'],
    ...portalCredentials.value.map(item => [item.studentName, item.username, item.temporaryPassword]),
  ]
  const content = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'opendojos-portal-credentials.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

watch(() => newStudent.dojoId, (dojoId) => {
  const dojo = dojos.value.find(item => item.id === dojoId)
  const defaultPlanIsAvailable = dojo?.defaultFeePlanId && availableFeePlanOptions.value.some(plan => plan.value === dojo.defaultFeePlanId)
  newStudent.feePlanId = defaultPlanIsAvailable ? dojo.defaultFeePlanId : undefined
})

async function archiveStudent(student: any) {
  if (!confirm(`Archive ${student.firstName} ${student.lastName}?`)) return
  try {
    await $fetch(`/api/students/${student.id}`, { method: 'DELETE' })
    student.status = 'archived'
    toast.add({ color: 'success', title: 'Student archived' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not archive student', description: error.data?.statusMessage || error.message })
  }
}

onMounted(loadData)
</script>
