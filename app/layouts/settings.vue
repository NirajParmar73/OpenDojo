<template>
  <div class="max-w-6xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Organization Settings</h1>

    <div class="border-b border-gray-200 mb-6">
      <nav class="flex space-x-8">
        <NuxtLink
          to="/settings/general"
          class="py-2 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
          active-class="border-blue-500 text-blue-600"
        >
          General
        </NuxtLink>
        <NuxtLink
          to="/settings/hierarchy/levels"
          class="py-2 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
          active-class="border-blue-500 text-blue-600"
        >
          Locations & structure
        </NuxtLink>
        <NuxtLink
          to="/settings/belts"
          class="py-2 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
          active-class="border-blue-500 text-blue-600"
        >
          Belt System
        </NuxtLink>
        <!-- ✅ NEW Finance Tab -->
        <NuxtLink
          to="/settings/finance/fee-plans"
          class="py-2 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
          active-class="border-blue-500 text-blue-600"
        >
          Finance
        </NuxtLink>
      </nav>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { user } = useUserSession()
if (user.value?.role !== 'owner' && user.value?.role !== 'admin') {
  throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
}
</script>
