<template>
  <img
    v-if="student.avatar"
    :src="student.avatar"
    alt=""
    class="shrink-0 object-cover"
    :class="size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl'"
  >
  <div
    v-else
    class="flex shrink-0 items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
    :class="size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl'"
  >
    {{ initials }}
  </div>
</template>

<script setup lang="ts">
type AvatarStudent = {
  firstName?: string | null
  lastName?: string | null
  avatar?: string | null
}

const props = withDefaults(defineProps<{
  student: AvatarStudent
  size?: 'default' | 'sm'
}>(), {
  size: 'default'
})

const initials = computed(() => `${props.student.firstName?.[0] || ''}${props.student.lastName?.[0] || ''}`)
</script>
