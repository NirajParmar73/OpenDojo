<template>
  <div v-if="application" class="mx-auto max-w-6xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><UButton to="/admissions/manage" color="neutral" variant="ghost" icon="i-lucide-arrow-left" class="mb-3">Applications</UButton><div class="flex items-center gap-3"><h2 class="text-2xl font-semibold">{{ application.firstName }} {{ application.lastName }}</h2><UBadge :color="badgeColor" variant="subtle" class="capitalize">{{ application.status.replaceAll('_', ' ') }}</UBadge></div><p class="mt-2 font-mono text-sm text-slate-500">{{ application.referenceNumber }}</p></div><UButton :href="`/api/admissions/${application.id}/pdf`" external color="neutral" variant="outline" icon="i-lucide-download">Download submitted PDF</UButton></section>
    <UAlert v-if="application.duplicates?.length" color="warning" title="Possible existing student" :description="`${application.duplicates.length} student record(s) use the same email or phone. Check before approving.`" />
    <div class="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div class="space-y-6">
        <UCard><template #header><h3 class="font-semibold">Student information</h3></template><div class="flex flex-col gap-6 sm:flex-row"><img :src="application.photoPath" alt="Applicant" class="h-48 w-36 rounded-xl object-cover"><dl class="grid flex-1 gap-4 sm:grid-cols-2"><InfoItem label="Name" :value="`${application.firstName} ${application.lastName}`" /><InfoItem label="Date of birth" :value="formatDate(application.dateOfBirth)" /><InfoItem label="Email" :value="application.email" /><InfoItem label="Phone" :value="application.phone" /><InfoItem label="Dojo" :value="application.dojo?.name" /><InfoItem label="Program" :value="application.program?.displayName || 'Not selected'" /><InfoItem label="Address" :value="address" /><InfoItem label="Preferred start" :value="application.preferredStartDate ? formatDate(application.preferredStartDate) : 'Not specified'" /></dl></div></UCard>
        <UCard><template #header><h3 class="font-semibold">Guardian, emergency, and medical</h3></template><dl class="grid gap-4 sm:grid-cols-2"><InfoItem label="Guardian" :value="application.guardianName || 'Not provided'" /><InfoItem label="Relationship" :value="application.guardianRelationship || '—'" /><InfoItem label="Guardian contact" :value="[application.guardianPhone, application.guardianEmail].filter(Boolean).join(' · ') || '—'" /><InfoItem label="Emergency contact" :value="`${application.emergencyContact} · ${application.emergencyPhone}`" /><InfoItem class="sm:col-span-2" label="Medical notes" :value="application.medicalNotes || 'None declared'" /><InfoItem class="sm:col-span-2" label="Previous experience" :value="application.previousExperience || 'None provided'" /></dl></UCard>
      </div>
      <aside class="space-y-6">
        <UCard><template #header><h3 class="font-semibold">Review actions</h3></template><div class="space-y-3">
          <UButton v-if="application.status === 'submitted'" block color="neutral" variant="outline" icon="i-lucide-eye" :loading="working" @click="review('start_review')">Start review</UButton>
          <UButton v-if="!application.physicalCopyReceivedAt && !finalized" block color="neutral" variant="outline" icon="i-lucide-file-check-2" :loading="working" @click="markPhysical">Mark physical copy received</UButton>
          <UAlert v-else-if="application.physicalCopyReceivedAt" color="success" title="Physical copy received" :description="`${formatDate(application.physicalCopyReceivedAt)}${application.physicalCopyReceiver?.name ? ` by ${application.physicalCopyReceiver.name}` : ''}`" />
          <UButton v-if="!finalized" block color="success" icon="i-lucide-user-check" :loading="working" @click="approve">Approve and create student</UButton>
          <UButton v-if="!finalized" block color="error" variant="soft" icon="i-lucide-circle-x" @click="toggleReject">Reject application</UButton>
          <div v-if="showReject" class="space-y-2"><UTextarea v-model="rejectionReason" class="w-full" placeholder="Reason for rejection" /><UButton block color="error" :loading="working" @click="review('reject')">Confirm rejection</UButton></div>
          <UButton v-if="application.resultingStudentId" :to="`/students/${application.resultingStudentId}`" block>Open student profile</UButton>
        </div></UCard>
        <UCard><template #header><h3 class="font-semibold">Internal notes</h3></template><UTextarea v-model="internalNotes" class="w-full" :rows="5" placeholder="Visible only to staff" /><UButton class="mt-3" block color="neutral" variant="outline" :loading="working" @click="review('save_notes')">Save notes</UButton></UCard>
        <UAlert color="info" title="Portal access stays off" description="Approval creates the student without credentials. Grant portal access separately from the student profile after approval." />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
const toast = useToast()
const { data: application, refresh } = await useFetch<any>(`/api/admissions/${route.params.id}`)
const working = ref(false)
const showReject = ref(false)
const rejectionReason = ref('')
const internalNotes = ref(application.value?.internalNotes || '')
watch(application, value => { internalNotes.value = value?.internalNotes || '' })
const finalized = computed(() => ['approved', 'rejected'].includes(application.value?.status))
const badgeColor = computed(() => application.value?.status === 'approved' ? 'success' : application.value?.status === 'rejected' ? 'error' : application.value?.status === 'physical_received' ? 'info' : 'warning')
const address = computed(() => [application.value?.address, application.value?.city, application.value?.stateProvince, application.value?.postalCode, application.value?.country].filter(Boolean).join(', ') || 'Not provided')
const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
async function run(action: () => Promise<any>, success: string) { working.value = true; try { await action(); await refresh(); toast.add({ color: 'success', title: success }) } catch (error: any) { toast.add({ color: 'error', title: 'Action failed', description: error.data?.statusMessage || error.message }) } finally { working.value = false } }
async function review(action: 'start_review' | 'reject' | 'save_notes') { await run(() => $fetch(`/api/admissions/${route.params.id}/review`, { method: 'PATCH', body: { action, internalNotes: internalNotes.value, rejectionReason: rejectionReason.value } }), action === 'reject' ? 'Application rejected' : 'Review updated') }
async function markPhysical() { await run(() => $fetch(`/api/admissions/${route.params.id}/physical-copy`, { method: 'POST' }), 'Physical copy recorded') }
async function approve() { await run(() => $fetch(`/api/admissions/${route.params.id}/approve`, { method: 'POST' }), 'Admission approved and student created') }
function toggleReject() { showReject.value = !showReject.value }
</script>
