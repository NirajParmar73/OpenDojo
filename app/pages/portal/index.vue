<template>
  <div class="mx-auto max-w-5xl">
    <section v-if="data" class="relative mb-6 min-h-60 overflow-hidden rounded-3xl border border-[#d8c7a7] bg-[#f5ead6] shadow-sm dark:border-white/10 dark:bg-slate-900">
      <img src="/illustrations/student-portal-watercolor-banner.png" alt="Watercolor illustration of a martial-arts student practicing" class="absolute inset-0 h-full w-full object-cover object-[68%_center] dark:brightness-75 dark:saturate-75" />
      <div class="absolute inset-0 bg-gradient-to-r from-[#f5ead6] via-[#f5ead6]/90 to-transparent dark:from-slate-950 dark:via-slate-950/90" />
      <div class="relative max-w-md px-6 py-8 sm:px-8 sm:py-10">
        <p class="text-sm font-semibold text-primary">STUDENT PORTAL</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl dark:text-white">Welcome, {{ data.student.firstName }}</h1>
        <p class="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{{ data.student.dojo?.name || 'Your dojo' }} · Your training journey, progress, and records in one place.</p>
        <div class="mt-5 inline-flex items-center gap-2 rounded-full border border-[#cab58f] bg-[#fff8e8]/80 px-3 py-1.5 text-xs font-medium text-[#5b4730] backdrop-blur dark:border-white/15 dark:bg-white/10 dark:text-slate-200"><UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5 text-primary" /> Keep showing up. Every class counts.</div>
      </div>
    </section>
    <div v-if="pending" class="space-y-4"><USkeleton class="h-24" /><USkeleton class="h-64" /></div>
    <UAlert v-else-if="error" color="error" title="Could not load your portal" description="Please try again." />
    <template v-else-if="data">
      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UCard><div class="flex items-start justify-between gap-3"><div><p class="text-sm text-slate-500">Current rank</p><p class="mt-2 text-xl font-semibold">{{ data.student.currentBeltRank?.name || 'Not assigned' }}</p><p class="mt-1 text-sm text-slate-400">{{ data.student.currentBeltRank?.level || '' }}</p></div><div class="rounded-2xl bg-primary/10 p-2.5 text-primary"><UIcon name="i-lucide-award" class="h-5 w-5" /></div></div></UCard>
        <UCard><div class="flex items-start justify-between gap-3"><div><p class="text-sm text-slate-500">Attendance</p><p class="mt-2 text-xl font-semibold">{{ data.attendanceSummary.rate }}%</p><p class="mt-1 text-sm text-slate-400">{{ data.attendanceSummary.present }} of {{ data.attendanceSummary.total }} attended</p></div><div class="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400"><UIcon name="i-lucide-calendar-check-2" class="h-5 w-5" /></div></div></UCard>
        <UCard><div class="flex items-start justify-between gap-3"><div><p class="text-sm text-slate-500">Achievements</p><p class="mt-2 text-xl font-semibold">{{ data.achievements.length }}</p></div><div class="rounded-2xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400"><UIcon name="i-lucide-trophy" class="h-5 w-5" /></div></div></UCard>
        <UCard><div class="flex items-start justify-between gap-3"><div><p class="text-sm text-slate-500">Payments recorded</p><p class="mt-2 text-xl font-semibold">{{ data.payments.length }}</p></div><div class="rounded-2xl bg-sky-500/10 p-2.5 text-sky-600 dark:text-sky-400"><UIcon name="i-lucide-receipt-indian-rupee" class="h-5 w-5" /></div></div></UCard>
      </div>
      <div class="mb-5 flex flex-wrap gap-2"><UButton v-for="item in tabs" :key="item.value" size="sm" :color="tab === item.value ? 'primary' : 'neutral'" :variant="tab === item.value ? 'solid' : 'soft'" @click="tab = item.value; void 0">{{ item.label }}</UButton></div>
      <div v-if="tab === 'profile'">
        <UCard>
          <template #header>
            <div class="flex items-center gap-4">
              <img v-if="data.student.avatar" :src="data.student.avatar" :alt="`${data.student.firstName} ${data.student.lastName}`" class="h-16 w-16 rounded-2xl object-cover shadow-sm">
              <div v-else class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">{{ studentInitials }}</div>
              <div><h2 class="font-semibold">My profile</h2><p class="mt-1 text-sm text-slate-500">{{ data.student.firstName }} {{ data.student.lastName }}</p></div>
            </div>
          </template>
          <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveProfile">
            <UFormField label="Email"><UInput v-model="profile.email" type="email" /></UFormField>
            <UFormField label="Phone"><UInput v-model="profile.phone" /></UFormField>
            <UFormField label="Address" class="sm:col-span-2"><UInput v-model="profile.address" /></UFormField>
            <UFormField label="Emergency contact person"><UInput v-model="profile.emergencyContact" /></UFormField>
            <UFormField label="Emergency phone"><UInput v-model="profile.emergencyPhone" /></UFormField>
            <div class="sm:col-span-2"><UButton type="submit" :loading="savingProfile">Save contact details</UButton></div>
          </form>
        </UCard>
      </div>
      <UCard v-else-if="tab === 'password'">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="rounded-xl bg-primary/10 p-2 text-primary"><UIcon name="i-lucide-key-round" class="h-5 w-5" /></div>
            <div><h2 class="font-semibold">Change password</h2><p class="mt-1 text-sm text-slate-500">Use a private password with at least 8 characters.</p></div>
          </div>
        </template>
        <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="changePassword">
          <UFormField label="Current password" class="sm:col-span-2"><UInput v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" required /></UFormField>
          <UFormField label="New password"><UInput v-model="passwordForm.newPassword" type="password" autocomplete="new-password" :minlength="8" required /></UFormField>
          <UFormField label="Confirm new password"><UInput v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" :minlength="8" required /></UFormField>
          <div class="sm:col-span-2"><UButton type="submit" :loading="changingPassword" icon="i-lucide-key-round">Change password</UButton></div>
        </form>
      </UCard>
      <UCard v-else-if="tab === 'progress'"><template #header><div class="flex items-center justify-between"><h2 class="font-semibold">My progress</h2><UButton size="sm" icon="i-lucide-download" :loading="downloadingPdf === 'progress'" @click="downloadPdf(`/api/students/${data.student.id}/progress-report`, `progress_${data.student.firstName}_${data.student.lastName}.pdf`, 'progress')">Download report</UButton></div></template><div v-if="data.gradings.length" class="space-y-3"><div v-for="grading in data.gradings" :key="grading.id" class="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p class="font-medium">{{ grading.beltRank?.name }} <span class="text-slate-500">{{ grading.beltRank?.level }}</span></p><p class="mt-1 text-sm text-slate-500">Awarded {{ formatDate(grading.awardedDate) }}</p><p v-if="grading.certificateNumber" class="mt-1 text-sm">Certificate: {{ grading.certificateNumber }}</p><a v-if="grading.certificateUrl" :href="grading.certificateUrl" target="_blank" class="mt-2 inline-block text-sm text-primary hover:underline">Open certificate</a></div></div><p v-else class="py-8 text-center text-slate-500">No gradings have been recorded yet.</p></UCard>
      <UCard v-else-if="tab === 'achievements'"><template #header><h2 class="font-semibold">My achievements</h2></template><div v-if="data.achievements.length" class="space-y-3"><div v-for="item in data.achievements" :key="item.id" class="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p class="font-medium">{{ item.tournamentName }}</p><p class="mt-1 text-sm text-slate-500">{{ item.eventType || 'Participation' }} · {{ formatDate(item.startDate) }}</p><p class="mt-1 text-sm">{{ item.result || 'Participation' }}<span v-if="item.medalType"> · {{ item.medalType }}</span></p><a v-if="item.certificateUrl" :href="item.certificateUrl" target="_blank" class="mt-2 inline-block text-sm text-primary hover:underline">Open certificate</a></div></div><p v-else class="py-8 text-center text-slate-500">No achievements have been recorded yet.</p></UCard>
      <UCard v-else-if="tab === 'fees'">
        <template #header><h2 class="font-semibold">My fee payments</h2></template>
        <div v-if="data.payments.length" class="divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="payment in data.payments" :key="payment.id" class="flex flex-wrap items-center justify-between gap-4 py-4">
            <div><p class="font-medium">{{ formatCurrency(payment.amount) }}</p><p class="mt-1 text-sm text-slate-500">{{ formatDate(payment.paymentDate) }} · {{ payment.method }}</p></div>
            <div class="flex items-center gap-3">
              <p class="text-sm text-slate-500">{{ payment.receiptNumber }}</p>
              <UButton size="xs" color="primary" variant="soft" icon="i-lucide-download" :loading="downloadingPdf === `payment-${payment.id}`" @click="downloadPdf(`/api/payments/${payment.id}/receipt`, `receipt_${payment.receiptNumber}.pdf`, `payment-${payment.id}`)">PDF</UButton>
            </div>
          </div>
        </div>
        <p v-else class="py-8 text-center text-slate-500">No payments have been recorded yet.</p>
      </UCard>
      <UCard v-else-if="tab === 'attendance'"><template #header><div class="flex items-center justify-between"><h2 class="font-semibold">My attendance</h2><UBadge color="primary" variant="subtle">{{ data.attendanceSummary.rate }}% attendance</UBadge></div></template><div class="mb-4 rounded-lg bg-primary/5 p-3 text-sm text-slate-600 dark:text-slate-300">Your attendance is <strong>{{ data.attendanceSummary.rate }}%</strong>. You need at least <strong>80% attendance</strong> to qualify for the next grading; final eligibility remains subject to instructor assessment and dojo policy.</div><div v-if="data.attendance.length" class="divide-y divide-slate-100 dark:divide-slate-800"><div v-for="record in data.attendance" :key="record.id" class="flex flex-wrap items-center justify-between gap-3 py-4"><div><p class="font-medium">{{ record.session?.name || 'Class' }}</p><p class="mt-1 text-sm text-slate-500">{{ formatDate(record.session?.date) }} · {{ record.session?.startTime }}–{{ record.session?.endTime }} · {{ record.session?.dojo?.name || data.student.dojo?.name }}</p><p v-if="record.notes" class="mt-1 text-sm text-slate-500">{{ record.notes }}</p></div><UBadge :color="attendanceColor(record.status)" variant="subtle" class="capitalize">{{ record.status }}</UBadge></div></div><p v-else class="py-8 text-center text-slate-500">No attendance has been recorded yet.</p></UCard>
      <UCard v-else><template #header><h2 class="font-semibold">My documents</h2></template><div v-if="data.documents.length" class="divide-y divide-slate-100 dark:divide-slate-800"><a v-for="document in data.documents" :key="document.id" :href="document.fileUrl" target="_blank" class="flex items-center justify-between py-4 text-primary hover:underline"><span>{{ document.documentType.replaceAll('_', ' ') }}</span><UIcon name="i-lucide-external-link" /></a></div><p v-else class="py-8 text-center text-slate-500">No documents have been shared yet.</p></UCard>
      <UCard v-if="tab === 'fees' && portalRefunds.length" class="mt-4">
        <template #header><div><h2 class="font-semibold">Refunds</h2><p class="mt-1 text-sm text-slate-500">Refunds recorded against your fee payments.</p></div></template>
        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="refund in portalRefunds" :key="refund.id" class="flex flex-wrap items-center justify-between gap-4 py-4">
            <div><p class="font-medium text-red-600">-{{ formatCurrency(refund.amount) }}</p><p class="mt-1 text-sm text-slate-500">{{ formatDate(refund.refundedAt) }} · {{ refund.reason }} · Original receipt {{ refund.receiptNumber }}</p></div>
            <UButton size="xs" color="error" variant="soft" icon="i-lucide-download" :loading="downloadingPdf === `refund-${refund.id}`" @click="downloadPdf(`/api/refunds/${refund.id}/receipt`, `refund_${refund.refundNumber}.pdf`, `refund-${refund.id}`)">Refund PDF</UButton>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'portal-auth', layout: 'portal' })
const route = useRoute(); const toast = useToast(); const allowedTabs = ['profile', 'attendance', 'progress', 'achievements', 'fees', 'documents', 'password']; const tab = ref(allowedTabs.includes(String(route.query.tab)) ? String(route.query.tab) : 'profile'); const savingProfile = ref(false); const tabs = [{ label: 'Profile', value: 'profile' }, { label: 'Attendance', value: 'attendance' }, { label: 'Progress', value: 'progress' }, { label: 'Achievements', value: 'achievements' }, { label: 'Fees', value: 'fees' }, { label: 'Documents', value: 'documents' }, { label: 'Password', value: 'password' }]
const { data, pending, error, refresh } = await useFetch<any>('/api/portal/me')
watch(() => route.query.tab, (value) => { if (allowedTabs.includes(String(value))) tab.value = String(value) })
const studentInitials = computed(() => data.value ? `${data.value.student.firstName?.[0] || ''}${data.value.student.lastName?.[0] || ''}`.toUpperCase() : 'S')
const portalRefunds = computed(() => (data.value?.payments || []).flatMap((payment: any) =>
  (payment.refunds || [])
    .filter((refund: any) => refund.status === 'completed')
    .map((refund: any) => ({ ...refund, receiptNumber: payment.receiptNumber }))
).sort((a: any, b: any) => new Date(b.refundedAt).getTime() - new Date(a.refundedAt).getTime()))
const profile = reactive({ email: '', phone: '', address: '', emergencyContact: '', emergencyPhone: '' })
const changingPassword = ref(false)
const downloadingPdf = ref<string | null>(null)
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
watchEffect(() => { if (data.value) Object.assign(profile, { email: data.value.student.email || '', phone: data.value.student.phone || '', address: data.value.student.address || '', emergencyContact: data.value.student.emergencyContact || '', emergencyPhone: data.value.student.emergencyPhone || '' }) })
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) }; function formatCurrency(amount: number) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: data.value?.currency || 'USD' }).format(amount / 100) }
function attendanceColor(status: string) { return status === 'present' ? 'success' : status === 'late' ? 'warning' : status === 'excused' ? 'info' : 'error' }
async function saveProfile() { savingProfile.value = true; try { await $fetch('/api/portal/profile', { method: 'PATCH', body: profile }); await refresh(); toast.add({ color: 'success', title: 'Profile updated' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not update profile', description: error.data?.statusMessage || error.message }) } finally { savingProfile.value = false } }
async function downloadPdf(url: string, fallbackFilename: string, downloadKey: string) {
  downloadingPdf.value = downloadKey
  try {
    const response = await fetch(url, { credentials: 'same-origin' })
    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'The PDF could not be generated.')
    }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('application/pdf')) throw new Error('The server did not return a PDF.')

    const disposition = response.headers.get('content-disposition') || ''
    const headerFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    const blobUrl = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = headerFilename || fallbackFilename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Download failed', description: error.message || 'Please try again.' })
  } finally {
    downloadingPdf.value = null
  }
}
async function changePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    toast.add({ color: 'warning', title: 'Passwords do not match' })
    return
  }
  changingPassword.value = true
  try {
    await $fetch('/api/portal/password', { method: 'PUT', body: { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword } })
    Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    toast.add({ color: 'success', title: 'Password changed' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not change password', description: error.data?.statusMessage || error.message })
  } finally {
    changingPassword.value = false
  }
}
</script>
