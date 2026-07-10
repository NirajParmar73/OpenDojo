<template>
  <div class="p-10 max-w-100 mx-auto">
    <h1 class="text-2xl font-bold">Your Profile</h1>
    <div class="flex items-center gap-4 mt-4">
      <img v-if="user?.avatar" :src="user.avatar" class="w-20 h-20 rounded-full object-cover" />
      <div v-else class="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">No avatar</div>
      <UInput type="file" accept="image/*" @change="onFileChange" />
      <UButton @click="uploadAvatar" :loading="uploading">Upload</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user, fetch } = useUserSession()
const toast = useToast()
const avatarFile = ref<File | null>(null)
const uploading = ref(false)

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  avatarFile.value = target.files?.[0] ?? null
}
async function uploadAvatar() {
  if (!avatarFile.value) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('avatar', avatarFile.value)
    await $fetch('/api/user/avatar', {
      method: 'POST',
      body: fd,
    })
    await fetch()
    toast.add({ color: 'success', title: 'Avatar updated' })
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Upload failed',
      description: error.data?.statusMessage || error.message || 'Unknown error',
    })
  } finally {
    uploading.value = false
  }
}
</script>