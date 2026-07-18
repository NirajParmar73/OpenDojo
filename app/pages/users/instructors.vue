<template>
  <div class="mx-auto max-w-5xl">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-primary">PEOPLE</p>
        <h2 class="mt-1 text-2xl font-semibold">Instructors in your territory</h2>
        <p class="mt-2 text-sm text-slate-500">Only instructors assigned within your permitted hierarchy are listed.</p>
      </div>
      <UButton v-if="canAddInstructor" to="/users?add=instructor" icon="i-lucide-user-plus">Add instructor</UButton>
    </div>

    <UCard class="mt-6">
      <div v-if="instructors?.length" class="divide-y divide-slate-100 dark:divide-slate-800">
        <div v-for="instructor in instructors" :key="instructor.id" class="flex items-center justify-between py-4">
          <div>
            <p class="font-medium">{{ instructor.name }}</p>
            <p class="mt-1 text-sm text-slate-500">{{ instructor.assignments.filter((item: any) => item.role === 'instructor').map((item: any) => item.scopeName || item.scopeType).join(', ') }}</p>
          </div>
          <UButton :to="`/users/${instructor.id}/edit`" size="sm" color="primary" variant="soft">Manage</UButton>
        </div>
      </div>
      <p v-else class="py-10 text-center text-sm text-slate-500">No instructors are assigned in your territory.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { data: users } = await useFetch<any[]>('/api/users')
const { data: permissions } = await useFetch<{ allowedRoles: string[], allowedDojoIds: number[] }>('/api/users/me/permissions')
const instructors = computed(() => (users.value || []).filter(user => user.assignments?.some((assignment: any) => assignment.role === 'instructor')))
const canAddInstructor = computed(() => {
  const currentPermissions = permissions.value
  return !!currentPermissions && currentPermissions.allowedRoles.includes('instructor') && currentPermissions.allowedDojoIds.length > 0
})
</script>
