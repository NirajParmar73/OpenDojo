<template>
  <div class="mx-auto max-w-7xl">
    <section class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm font-semibold text-primary">PEOPLE</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Student directory</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Find students quickly, update essential details, and open their full record.</p>
      </div>
      <UButton color="primary" icon="i-lucide-user-plus" size="lg" @click="toggleCreateForm">
        {{ showCreate ? 'Close form' : 'Add student' }}
      </UButton>
    </section>

    <UCard v-if="showCreate" class="mb-6">
      <template #header><div><h3 class="font-semibold">Add a student</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Start with the essentials. Complete fees, guardians, documents, and gradings from the student profile.</p></div></template>
      <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" @submit.prevent="createStudent">
        <UInput v-model="newStudent.firstName" placeholder="First name" required />
        <UInput v-model="newStudent.lastName" placeholder="Last name" required />
        <USelect v-model="newStudent.dojoId" :items="dojoOptions" placeholder="Assign dojo (optional)" />
        <UInput v-model="newStudent.email" type="email" placeholder="Email address" />
        <UInput v-model="newStudent.phone" placeholder="Phone number" />
        <UInput v-model="newStudent.dateOfBirth" type="date" />
        <USelect v-model="newStudent.gender" :items="genderOptions" placeholder="Gender (optional)" />
        <UInput v-model="newStudent.emergencyContact" placeholder="Emergency contact" />
        <UInput v-model="newStudent.emergencyPhone" placeholder="Emergency phone" />
        <div class="md:col-span-2 xl:col-span-3 flex flex-wrap justify-end gap-2 pt-2">
          <UButton type="button" color="neutral" variant="ghost" @click="resetCreateForm">Cancel</UButton>
          <UButton type="submit" color="primary" :loading="creating">Create student</UButton>
        </div>
      </form>
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
            <USelect v-model="statusFilter" :items="statusFilterOptions" class="w-full sm:w-36" />
          </div>
        </div>
      </template>

      <div v-if="loading" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="index in 6" :key="index" class="h-32 rounded-2xl" />
      </div>

      <UAlert v-else-if="loadError" color="error" title="Could not load students" :description="loadError" />

      <template v-else>
        <div class="grid gap-3 md:hidden">
          <article v-for="student in filteredStudents" :key="student.id" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div class="flex items-start gap-3">
              <StudentAvatar :student="student" />
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <NuxtLink :to="`/students/${student.id}`" class="truncate font-semibold hover:text-primary">{{ student.firstName }} {{ student.lastName }}</NuxtLink>
                  <UBadge :color="student.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="shrink-0 capitalize">{{ student.status }}</UBadge>
                </div>
                <p class="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{{ student.dojo?.name || 'No dojo assigned' }}</p>
                <p class="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{{ student.email || student.phone || 'No contact details' }}</p>
              </div>
            </div>
            <div class="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <UButton :to="`/students/${student.id}`" size="sm" color="primary" variant="soft">Profile</UButton>
              <UButton :to="`/students/${student.id}/edit`" size="sm" color="neutral" variant="ghost">Edit</UButton>
              <UButton size="sm" color="error" variant="ghost" @click="archiveStudent(student)">Archive</UButton>
            </div>
          </article>
        </div>

        <div class="hidden overflow-x-auto md:block">
          <table class="min-w-full text-sm">
            <thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr><th class="px-3 py-3">Student</th><th class="px-3 py-3">Dojo</th><th class="px-3 py-3">Rank</th><th class="px-3 py-3">Contact</th><th class="px-3 py-3">Status</th><th class="px-3 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              <tr v-for="student in filteredStudents" :key="student.id" class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td class="px-3 py-4"><div class="flex items-center gap-3"><StudentAvatar :student="student" size="sm" /><NuxtLink :to="`/students/${student.id}`" class="font-medium hover:text-primary">{{ student.firstName }} {{ student.lastName }}</NuxtLink></div></td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ student.dojo?.name || '—' }}</td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ student.currentBeltRank?.name || '—' }}</td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300"><p>{{ student.email || '—' }}</p><p class="mt-1 text-xs text-slate-400">{{ student.phone || '' }}</p></td>
                <td class="px-3 py-4"><UBadge :color="student.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="capitalize">{{ student.status }}</UBadge></td>
                <td class="px-3 py-4"><div class="flex justify-end gap-1"><UButton :to="`/students/${student.id}`" size="xs" color="primary" variant="soft">Profile</UButton><UButton :to="`/students/${student.id}/edit`" size="xs" color="neutral" variant="ghost">Edit</UButton><UButton size="xs" color="error" variant="ghost" @click="archiveStudent(student)">Archive</UButton></div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState v-if="!filteredStudents.length" icon="i-lucide-users-round" :message="students.length ? 'No students match your search or filter.' : 'Add your first student to begin managing your dojo.'" />
      </template>
    </UCard>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const students = ref<any[]>([])
const dojos = ref<any[]>([])
const loading = ref(true)
const loadError = ref('')
const creating = ref(false)
const showCreate = ref(false)
const search = ref('')
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

const newStudent = reactive({ firstName: '', lastName: '', dojoId: null as number | null, email: '', phone: '', dateOfBirth: '', gender: undefined as string | undefined, emergencyContact: '', emergencyPhone: '' })

const dojoOptions = computed(() => dojos.value.map(dojo => ({ label: dojo.name, value: dojo.id })))
const filteredStudents = computed(() => {
  const query = search.value.trim().toLowerCase()
  return students.value.filter((student) => {
    const matchesStatus = statusFilter.value === 'all' || student.status === statusFilter.value
    const haystack = `${student.firstName} ${student.lastName} ${student.email || ''} ${student.phone || ''}`.toLowerCase()
    return matchesStatus && (!query || haystack.includes(query))
  })
})

function resetCreateForm() {
  Object.assign(newStudent, { firstName: '', lastName: '', dojoId: null, email: '', phone: '', dateOfBirth: '', gender: undefined, emergencyContact: '', emergencyPhone: '' })
  showCreate.value = false
}

function toggleCreateForm() {
  showCreate.value = !showCreate.value
}

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const [studentData, dojoData] = await Promise.all([$fetch('/api/students'), $fetch('/api/dojos')])
    students.value = studentData as any[]
    dojos.value = dojoData as any[]
  } catch (error: any) {
    loadError.value = error.data?.statusMessage || error.message || 'Please try again.'
  } finally {
    loading.value = false
  }
}

async function createStudent() {
  creating.value = true
  try {
    const response = await $fetch('/api/students', {
      method: 'POST',
      body: { ...newStudent, email: newStudent.email || null, phone: newStudent.phone || null, dateOfBirth: newStudent.dateOfBirth || null, gender: newStudent.gender || null, emergencyContact: newStudent.emergencyContact || null, emergencyPhone: newStudent.emergencyPhone || null },
    }) as any
    students.value.unshift(response.student)
    resetCreateForm()
    toast.add({ color: 'success', title: 'Student created' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not create student', description: error.data?.statusMessage || error.message })
  } finally {
    creating.value = false
  }
}

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

const StudentAvatar = defineComponent({
  props: { student: { type: Object, required: true }, size: { type: String, default: 'default' } },
  computed: {
    initials() { const student = this.student as any; return `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}` },
  },
  template: '<img v-if="student.avatar" :src="student.avatar" alt="" class="h-11 w-11 shrink-0 rounded-xl object-cover" :class="{ \'h-9 w-9 rounded-lg\': size === \'sm\' }"><div v-else class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300" :class="{ \'h-9 w-9 rounded-lg\': size === \'sm\' }">{{ initials }}</div>',
})

const EmptyState = defineComponent({
  props: { icon: { type: String, required: true }, message: { type: String, required: true } },
  template: '<div class="py-12 text-center"><UIcon :name="icon" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" /><p class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ message }}</p></div>',
})

onMounted(loadData)
</script>
