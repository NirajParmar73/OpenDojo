<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-6">
      <UButton to="/users" color="neutral" variant="ghost" icon="i-lucide-arrow-left">Staff directory</UButton>
      <h2 class="mt-3 text-2xl font-semibold tracking-tight">Edit staff member</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Update account details and the locations this person can manage.</p>
    </div>

    <UCard v-if="pending"><div class="space-y-4"><USkeleton class="h-10" /><USkeleton class="h-10" /><USkeleton class="h-24" /></div></UCard>
    <UAlert v-else-if="error" color="error" title="Unable to load staff member" :description="error.message" />
    <UCard v-else-if="user">
      <form class="space-y-7" @submit.prevent="save">
        <div>
          <h3 class="font-semibold">Account details</h3>
          <div class="mt-4 grid gap-5 md:grid-cols-2">
            <UFormField label="Full name" required><UInput v-model="form.name" required /></UFormField>
            <UFormField label="Email" required><UInput v-model="form.email" type="email" required /></UFormField>
            <UFormField label="Dan degree"><UInput v-model="form.danDegree" /></UFormField>
            <UFormField label="Account role"><USelect v-model="form.role" :items="accountRoleOptions" :disabled="user.role === 'owner'" /></UFormField>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-7 dark:border-slate-800">
          <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div><h3 class="font-semibold">Scoped responsibilities</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Add responsibility for a hierarchy node or a specific dojo.</p></div>
            <UButton type="button" size="sm" color="primary" variant="soft" icon="i-lucide-plus" @click="addAssignment">Add responsibility</UButton>
          </div>
          <div v-if="form.assignments.length" class="mt-4 space-y-3">
            <div v-for="(assignment, index) in form.assignments" :key="index" class="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_1fr_auto] dark:border-slate-800">
              <USelect v-model="assignment.role" :items="scopedRoleOptions" placeholder="Responsibility" @update:model-value="assignment.scopeId = null" />
              <USelect v-if="isNodeRole(assignment.role)" v-model="assignment.scopeId" :items="nodeOptions" placeholder="Select hierarchy node" />
              <USelect v-else v-model="assignment.scopeId" :items="dojoOptions" placeholder="Select dojo" />
              <UButton type="button" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Remove responsibility" @click="form.assignments.splice(index, 1)" />
            </div>
          </div>
          <p v-else class="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">No scoped responsibilities. This person can sign in but has no assigned operational area.</p>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800"><UButton to="/users" color="neutral" variant="ghost">Cancel</UButton><UButton type="submit" color="primary" :loading="saving">Save changes</UButton></div>
      </form>
    </UCard>

    <UCard v-if="user" class="mt-6">
      <template #header><div><h3 class="font-semibold">Instructor credentials</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Record qualifications for the martial-arts programs this person teaches.</p></div></template>
      <form class="grid gap-4 sm:grid-cols-3" @submit.prevent="addQualification">
        <USelect v-model="qualificationForm.programId" :items="programOptions" placeholder="Program (optional)" />
        <UInput v-model="qualificationForm.qualification" placeholder="Qualification" />
        <UInput v-model="qualificationForm.issuer" placeholder="Issuing body" />
        <UInput v-model="qualificationForm.expiresAt" type="date" />
        <UButton type="submit" :loading="savingQualification">Add qualification</UButton>
      </form>
      <div v-if="qualifications?.length" class="mt-5 divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800"><div v-for="item in qualifications" :key="item.id" class="flex items-center justify-between gap-3 py-3"><div><p class="font-medium">{{ item.qualification }}</p><p class="mt-1 text-sm text-slate-500">{{ item.issuer || 'No issuing body' }}{{ item.expiresAt ? ` · Expires ${new Date(item.expiresAt).toLocaleDateString()}` : '' }}</p></div></div></div>
      <p v-else class="mt-5 text-sm text-slate-500">No instructor credentials recorded.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const userId = Number(route.params.id)
const saving = ref(false)
const savingQualification = ref(false)
const qualificationForm = reactive({ programId: null as number | null, qualification: '', issuer: '', expiresAt: '' })
const form = reactive<any>({ name: '', email: '', danDegree: '', role: 'member', assignments: [] })
const roleScopeMap: Record<string, 'node' | 'dojo'> = { country_head: 'node', state_head: 'node', district_head: 'node', city_head: 'node', zone_head: 'node', dojo_head: 'dojo', instructor: 'dojo' }
const allRoleOptions = [{ label: 'Country Head', value: 'country_head' }, { label: 'State Head', value: 'state_head' }, { label: 'District Head', value: 'district_head' }, { label: 'City Head', value: 'city_head' }, { label: 'Zone Head', value: 'zone_head' }, { label: 'Dojo Head', value: 'dojo_head' }, { label: 'Instructor', value: 'instructor' }]
const accountRoleOptions = [{ label: 'Member', value: 'member' }, { label: 'Admin', value: 'admin' }]

const { data: user, pending, error } = await useFetch<any>(`/api/users/${userId}`)
const { data: permissions } = await useFetch<any>('/api/users/me/permissions')
const { data: nodes } = await useFetch<any[]>('/api/hierarchy/nodes')
const { data: dojos } = await useFetch<any[]>('/api/dojos')
const { data: programs } = await useFetch<any[]>('/api/organization/programs')
const { data: qualifications, refresh: refreshQualifications } = await useFetch<any[]>(`/api/instructor-qualifications?userId=${userId}`)

const scopedRoleOptions = computed(() => allRoleOptions.filter(role => permissions.value?.allowedRoles?.includes(role.value)))
const nodeOptions = computed(() => flattenNodes(nodes.value || []).filter(node => permissions.value?.allowedNodeIds?.includes(node.id)).map(node => ({ label: node.name, value: node.id })))
const dojoOptions = computed(() => (dojos.value || []).filter(dojo => permissions.value?.allowedDojoIds?.includes(dojo.id)).map(dojo => ({ label: dojo.name, value: dojo.id })))
const programOptions = computed(() => [{ label: 'Any program', value: null }, ...((programs.value || []).map(program => ({ label: program.displayName, value: program.id })))] )

watchEffect(() => {
  if (!user.value) return
  Object.assign(form, {
    name: user.value.name,
    email: user.value.email,
    danDegree: user.value.danDegree || '',
    role: user.value.role,
    assignments: user.value.assignments.map((assignment: any) => ({ role: assignment.role, scopeId: assignment.scopeId })),
  })
})

function flattenNodes(tree: any[]): any[] {
  return tree.flatMap(node => [node, ...flattenNodes(node.children || [])])
}
function isNodeRole(role: string) {
  return roleScopeMap[role] === 'node'
}
function addAssignment() {
  const initialRole = scopedRoleOptions.value[0]?.value
  if (!initialRole) {
    toast.add({ color: 'warning', title: 'No scoped roles are available for your account' })
    return
  }
  form.assignments.push({ role: initialRole, scopeId: null })
}

async function addQualification() {
  if (!qualificationForm.qualification.trim()) { toast.add({ color: 'warning', title: 'Enter a qualification' }); return }
  savingQualification.value = true
  try {
    await $fetch('/api/instructor-qualifications', { method: 'POST', body: { userId, programId: qualificationForm.programId, qualification: qualificationForm.qualification.trim(), issuer: qualificationForm.issuer.trim() || undefined, expiresAt: qualificationForm.expiresAt || undefined } })
    Object.assign(qualificationForm, { programId: null, qualification: '', issuer: '', expiresAt: '' })
    await refreshQualifications()
    toast.add({ color: 'success', title: 'Qualification added' })
  } catch (error: any) { toast.add({ color: 'error', title: 'Could not add qualification', description: error.data?.statusMessage || error.message }) } finally { savingQualification.value = false }
}

async function save() {
  const assignments = form.assignments.map((assignment: any) => ({ role: assignment.role, scopeType: isNodeRole(assignment.role) ? 'node' : 'dojo', scopeId: Number(assignment.scopeId) }))
  if (assignments.some((assignment: any) => !assignment.scopeId)) {
    toast.add({ color: 'warning', title: 'Select a scope for every responsibility' })
    return
  }

  saving.value = true
  try {
    const body: any = { name: form.name, email: form.email, danDegree: form.danDegree || null, assignments }
    if (user.value.role !== 'owner') body.role = form.role
    await $fetch(`/api/users/${userId}`, { method: 'PATCH', body })
    toast.add({ color: 'success', title: 'Staff member updated' })
    await router.push('/users')
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not save changes', description: error.data?.statusMessage || error.message })
  } finally {
    saving.value = false
  }
}
</script>
