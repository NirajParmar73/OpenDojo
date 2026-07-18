<template><div class="mx-auto max-w-md py-16"><UCard><h1 class="text-2xl font-semibold">Verify your email</h1><p class="mt-2 text-sm text-slate-500">{{ message }}</p><UButton class="mt-6" to="/auth/login">Continue to sign in</UButton></UCard></div></template>
<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const route = useRoute()
const message = ref('Verifying your email address…')
onMounted(async () => { try { await $fetch('/api/auth/verify-email', { method: 'POST', body: { token: route.query.token } }); message.value = 'Your email address is verified. You can now sign in.' } catch (error: any) { message.value = error.data?.statusMessage || 'This verification link is invalid or expired.' } })
</script>
