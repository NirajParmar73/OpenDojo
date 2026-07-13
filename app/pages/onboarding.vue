<template>
  <div>
    <div class="mb-7 text-center">
      <p class="text-sm font-semibold text-primary">ORGANIZATION SETUP</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">Start your dojo workspace</h1>
      <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Set up your organization, owner account, and first martial-arts program.</p>
    </div>
    <form class="space-y-7" enctype="multipart/form-data" @submit.prevent="onSubmit">
      <section>
        <div class="mb-4 flex items-center gap-3"><span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span><div><h2 class="font-semibold">Organization</h2><p class="text-xs text-slate-500 dark:text-slate-400">Your public dojo identity.</p></div></div>
        <div class="space-y-4"><UFormField label="Organization name" required><UInput v-model="form.organizationName" placeholder="e.g. KGI Gujarat" autocomplete="organization" /></UFormField><UFormField label="Organization logo"><UInput type="file" accept="image/*" @change="onFileChange" /></UFormField></div>
      </section>
      <section class="border-t border-slate-100 pt-6 dark:border-slate-800">
        <div class="mb-4 flex items-center gap-3"><span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span><div><h2 class="font-semibold">Owner account</h2><p class="text-xs text-slate-500 dark:text-slate-400">You will manage this organization.</p></div></div>
        <div class="grid gap-4 sm:grid-cols-2"><UFormField label="Your name" required><UInput v-model="form.name" autocomplete="name" /></UFormField><UFormField label="Email address" required><UInput v-model="form.email" type="email" autocomplete="email" /></UFormField><UFormField label="Password" required class="sm:col-span-2"><UInput v-model="form.password" type="password" autocomplete="new-password" placeholder="At least 8 characters" /></UFormField></div>
      </section>
      <section class="border-t border-slate-100 pt-6 dark:border-slate-800">
        <div class="mb-4 flex items-center gap-3"><span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">3</span><div><h2 class="font-semibold">First program</h2><p class="text-xs text-slate-500 dark:text-slate-400">You can add more martial arts and styles later.</p></div></div>
        <div class="space-y-4"><UFormField label="Primary martial art" required><USelect v-model="form.martialArt" :items="martialArtOptions" /></UFormField><UFormField label="Style or lineage" required><USelect v-if="form.martialArt !== 'custom'" v-model="form.style" :items="styleOptions" /><UInput v-else v-model="form.style" placeholder="Enter your martial art or style" /><UInput v-if="form.martialArt !== 'custom' && form.style === 'custom'" v-model="form.customStyle" class="mt-2" placeholder="Enter your style or lineage" /></UFormField></div>
      </section>
      <UButton type="submit" block size="lg" :loading="loading" icon="i-lucide-building-2">Create organization</UButton>
    </form>
    <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">Already have an account? <NuxtLink to="/auth/login" class="font-medium text-primary hover:underline">Sign in</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const toast = useToast()
const loading = ref(false)
const form = reactive({
  organizationName: '',
  name: '',
  email: '',
  password: '',
  martialArt: 'karate',
  style: 'goju_ryu',
  customStyle: '',
})
const martialArtOptions = [
  { label: 'Karate', value: 'karate' }, { label: 'Kung Fu / Wushu', value: 'kung_fu' }, { label: 'Kobudo', value: 'kobudo' }, { label: 'Taekwondo', value: 'taekwondo' }, { label: 'Judo', value: 'judo' }, { label: 'Brazilian Jiu-Jitsu', value: 'bjj' }, { label: 'Muay Thai', value: 'muay_thai' }, { label: 'MMA', value: 'mma' }, { label: 'Custom / other', value: 'custom' },
]
const stylesByArt: Record<string, Array<{ label: string, value: string }>> = {
  karate: [{ label: 'Goju-ryu', value: 'goju_ryu' }, { label: 'Shotokan', value: 'shotokan' }, { label: 'Shito-ryu', value: 'shito_ryu' }, { label: 'Wado-ryu', value: 'wado_ryu' }, { label: 'Kyokushin', value: 'kyokushin' }, { label: 'Other / custom', value: 'custom' }],
  kung_fu: [{ label: 'Wing Chun', value: 'wing_chun' }, { label: 'Hung Gar', value: 'hung_gar' }, { label: 'Choy Li Fut', value: 'choy_li_fut' }, { label: 'Shaolin', value: 'shaolin' }, { label: 'Tai Chi', value: 'tai_chi' }, { label: 'Other / custom', value: 'custom' }],
}
const styleOptions = computed(() => stylesByArt[form.martialArt] || [{ label: 'Organization-defined program', value: 'organization_defined' }])
watch(() => form.martialArt, () => { form.style = styleOptions.value[0]?.value || '' })
const logoFile = ref<File | null>(null)

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  logoFile.value = target.files?.[0] ?? null
}

async function onSubmit() {
  loading.value = true
  try {
    const fd = new FormData()
    fd.append('organizationName', form.organizationName)
    fd.append('name', form.name)
    fd.append('email', form.email)
    fd.append('password', form.password)
    fd.append('martialArt', form.martialArt)
    fd.append('style', form.style === 'custom' ? form.customStyle : form.style)
    if (logoFile.value) {
      fd.append('logo', logoFile.value)
    }

    await $fetch('/api/onboarding', {
      method: 'POST',
      body: fd,
    })
    await navigateTo('/')
  } catch (error: any) {
  toast.add({ color: 'error', title: 'Onboarding failed', description: error.data?.statusMessage || error.message })
}
  finally {
    loading.value = false
  }
}
</script>
