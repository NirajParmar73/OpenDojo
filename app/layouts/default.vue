<template>
  <div class="min-h-screen flex">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-800 text-white flex flex-col">
      <div class="p-4 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <img
            v-if="orgLogo"
            :src="orgLogo"
            alt="Organization Logo"
            class="h-10 w-10 object-contain rounded-full"
          />
          <div v-else class="h-10 w-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
            {{ orgName?.charAt(0) || 'O' }}
          </div>
          <span class="text-lg font-semibold truncate">{{ orgName || 'OpenDojo' }}</span>
        </div>
      </div>
      <nav class="flex-1 p-4 space-y-2">
        <NuxtLink to="/" class="block py-2 px-3 rounded hover:bg-gray-700">Dashboard</NuxtLink>
        <NuxtLink to="/hierarchy/levels" class="block py-2 px-3 rounded hover:bg-gray-700">Hierarchy Levels</NuxtLink>
        <NuxtLink to="/hierarchy/nodes" class="block py-2 px-3 rounded hover:bg-gray-700">Hierarchy Nodes</NuxtLink>
        <NuxtLink to="/dojos" class="block py-2 px-3 rounded hover:bg-gray-700">Dojos</NuxtLink>
        <NuxtLink to="/students" class="block py-2 px-3 rounded hover:bg-gray-700">Students</NuxtLink>
        <NuxtLink to="/attendance" class="block py-2 px-3 rounded hover:bg-gray-700">Attendance</NuxtLink>
        <NuxtLink to="/reports/attendance" class="block py-2 px-3 rounded hover:bg-gray-700">
          Attendance Reports
        </NuxtLink>
        <NuxtLink to="/users" class="block py-2 px-3 rounded hover:bg-gray-700">Users</NuxtLink>
        <NuxtLink to="/settings" class="block py-2 px-3 rounded hover:bg-gray-700">Settings</NuxtLink>
      </nav>
      <div class="p-4 border-t border-gray-700">
        <button @click="logout" class="w-full text-left py-2 px-3 rounded hover:bg-gray-700">
          Logout
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <!-- Top Bar -->
      <header class="bg-white shadow p-4 flex justify-between items-center">
        <h1 class="text-xl font-semibold">{{ pageTitle }}</h1>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">{{ user?.name }}</span>
          <img
            v-if="user?.avatar"
            :src="user.avatar"
            class="h-8 w-8 rounded-full object-cover"
          />
          <div v-else class="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600">
            {{ user?.name?.charAt(0) || 'U' }}
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">

const { user, clear } = useUserSession()
const router = useRouter()

const orgName = computed(() => user.value?.organizationName || 'OpenDojo')
const orgLogo = computed(() => user.value?.organizationLogo || null)

// Optional: set page title based on route
const route = useRoute()
const pageTitle = computed(() => {
  // You can map routes to titles, or just use the route name
  return route.meta?.title || 'Dashboard'
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  router.push('/auth/login')
}
</script>