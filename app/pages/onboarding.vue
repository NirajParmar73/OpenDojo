<template>
  <div>
    <div class="mb-7"><div class="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400"><span>Set up your workspace</span><span>Step {{ step }} of {{ totalSteps }}</span></div><div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${(step / totalSteps) * 100}%` }" /></div></div>
    <form class="space-y-6" enctype="multipart/form-data" @submit.prevent="next">
      <section v-if="step === 1"><p class="text-sm font-semibold text-primary">LET’S GET STARTED</p><h1 class="mt-2 text-2xl font-semibold tracking-tight">What is your organization called?</h1><p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Use the name your students and parents know you by.</p><UFormField class="mt-6" label="Organization name"><UInput v-model="form.organizationName" autofocus placeholder="For example, Sunrise Karate Academy" autocomplete="organization" /></UFormField></section>
      <section v-else-if="step === 2"><p class="text-sm font-semibold text-primary">YOUR MAIN LOCATION</p><h1 class="mt-2 text-2xl font-semibold tracking-tight">What do you call your main dojo?</h1><p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">This is where you teach today. You can add more locations later.</p><UFormField class="mt-6" label="Dojo name"><UInput v-model="form.dojoName" autofocus placeholder="For example, Sunrise Karate — Main Dojo" /></UFormField></section>
      <section v-else-if="step === 3"><p class="text-sm font-semibold text-primary">WHAT YOU TEACH</p><h1 class="mt-2 text-2xl font-semibold tracking-tight">Which martial art do you teach?</h1><p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">This helps us prepare your workspace. You can add more later.</p><UFormField class="mt-6" label="Martial art"><USelect v-model="form.martialArt" :items="martialArtOptions" /></UFormField><UFormField class="mt-4" label="Style or school"><USelect v-if="form.martialArt !== 'custom'" v-model="form.style" :items="styleOptions" /><UInput v-else v-model="form.style" placeholder="Type the martial art or style" /><UInput v-if="form.martialArt !== 'custom' && form.style === 'custom'" v-model="form.customStyle" class="mt-2" placeholder="Type your style" /></UFormField></section>
      <section v-else-if="step === 4"><p class="text-sm font-semibold text-primary">YOUR SIGN-IN</p><h1 class="mt-2 text-2xl font-semibold tracking-tight">Who will manage the dojo?</h1><p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">This will be the main account for your workspace.</p><div class="mt-6 space-y-4"><UFormField label="Your name"><UInput v-model="form.name" autofocus autocomplete="name" placeholder="Your full name" /></UFormField><UFormField label="Email address"><UInput v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" /></UFormField><UFormField label="Choose a password"><UInput v-model="form.password" type="password" autocomplete="new-password" placeholder="At least 8 characters" /></UFormField></div></section>
      <section v-else><p class="text-sm font-semibold text-primary">ALMOST READY</p><h1 class="mt-2 text-2xl font-semibold tracking-tight">Would you like to add a logo?</h1><p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">This is optional. You can add or change it later.</p><UFormField class="mt-6" label="Organization logo (optional)"><UInput type="file" accept="image/*" @change="onFileChange" /></UFormField><div class="mt-6 rounded-2xl bg-slate-100 p-4 text-sm dark:bg-slate-800"><p class="font-semibold">We will create</p><ul class="mt-2 space-y-1 text-slate-600 dark:text-slate-300"><li>• Your organization and main dojo</li><li>• Your owner account</li><li>• A ready-to-use belt system for {{ martialArtLabel }}</li></ul></div></section>
      <div class="flex items-center justify-between gap-3 pt-2"><UButton v-if="step > 1" type="button" color="neutral" variant="ghost" icon="i-lucide-arrow-left" @click="step--">Back</UButton><span v-else /><UButton type="submit" color="primary" :loading="loading" :icon="step === totalSteps ? 'i-lucide-check' : 'i-lucide-arrow-right'">{{ step === totalSteps ? 'Create my workspace' : 'Continue' }}</UButton></div>
    </form>
    <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">Already have an account? <NuxtLink to="/auth/login" class="font-medium text-primary hover:underline">Sign in</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const toast = useToast()
const step = ref(1)
const totalSteps = 5
const loading = ref(false)
const logoFile = ref<File | null>(null)
const form = reactive({ organizationName: '', dojoName: '', name: '', email: '', password: '', martialArt: 'karate', style: 'goju_ryu', customStyle: '' })
const martialArtOptions = [{ label: 'Karate', value: 'karate' }, { label: 'Kung Fu / Wushu', value: 'kung_fu' }, { label: 'Taekwondo', value: 'taekwondo' }, { label: 'Judo', value: 'judo' }, { label: 'Brazilian Jiu-Jitsu', value: 'bjj' }, { label: 'Muay Thai', value: 'muay_thai' }, { label: 'MMA', value: 'mma' }, { label: 'Something else', value: 'custom' }]
const stylesByArt: Record<string, Array<{ label: string, value: string }>> = { karate: [{ label: 'Goju-ryu', value: 'goju_ryu' }, { label: 'Shotokan', value: 'shotokan' }, { label: 'Shito-ryu', value: 'shito_ryu' }, { label: 'Wado-ryu', value: 'wado_ryu' }, { label: 'Kyokushin', value: 'kyokushin' }, { label: 'Something else', value: 'custom' }], kung_fu: [{ label: 'Wing Chun', value: 'wing_chun' }, { label: 'Hung Gar', value: 'hung_gar' }, { label: 'Shaolin', value: 'shaolin' }, { label: 'Something else', value: 'custom' }] }
const styleOptions = computed(() => stylesByArt[form.martialArt] || [{ label: 'Use a simple default', value: 'organization_defined' }])
const martialArtLabel = computed(() => martialArtOptions.find(item => item.value === form.martialArt)?.label || 'your martial art')
watch(() => form.martialArt, () => { form.style = styleOptions.value[0]?.value || '' })

function onFileChange(event: Event) { logoFile.value = (event.target as HTMLInputElement).files?.[0] || null }
function validStep() {
  if (step.value === 1 && !form.organizationName.trim()) return 'Enter the name of your organization.'
  if (step.value === 2 && !form.dojoName.trim()) return 'Enter the name of your main dojo.'
  if (step.value === 3 && !(form.style === 'custom' ? form.customStyle.trim() : form.style)) return 'Choose or enter a style.'
  if (step.value === 4) { if (!form.name.trim()) return 'Enter your name.'; if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Enter a valid email address.'; if (form.password.length < 8) return 'Your password must be at least 8 characters.' }
  return null
}
async function next() {
  const message = validStep()
  if (message) { toast.add({ color: 'warning', title: message }); return }
  if (step.value < totalSteps) { step.value++; return }
  loading.value = true
  try {
    const fd = new FormData()
    for (const [key, value] of Object.entries(form)) fd.append(key, key === 'style' && value === 'custom' ? form.customStyle : value)
    if (logoFile.value) fd.append('logo', logoFile.value)
    const response = await $fetch<any>('/api/onboarding', { method: 'POST', body: fd })
    if (response.workspaceUrl) { window.location.assign(`${response.workspaceUrl}/auth/login?created=1&email=${encodeURIComponent(form.email)}`); return }
    await navigateTo({ path: '/auth/login', query: { created: '1', email: form.email } })
  } catch (error: any) { toast.add({ color: 'error', title: 'We could not create your workspace', description: error.data?.statusMessage || error.message }) } finally { loading.value = false }
}
</script>
