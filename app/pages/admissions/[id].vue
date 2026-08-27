<template>
  <div v-if="application" class="mx-auto max-w-6xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><UButton to="/admissions/manage" color="neutral" variant="ghost" icon="i-lucide-arrow-left" class="mb-3">Applications</UButton><div class="flex flex-wrap items-center gap-3"><h2 class="text-2xl font-semibold">{{ application.firstName }} {{ application.lastName }}</h2><UBadge :color="badgeColor" variant="subtle" class="capitalize">{{ application.status.replaceAll('_', ' ') }}</UBadge><UBadge :color="isExisting ? 'primary' : 'neutral'" variant="outline">{{ isExisting ? 'Existing student' : 'New admission' }}</UBadge></div><p class="mt-2 font-mono text-sm text-slate-500">{{ application.referenceNumber }}</p></div><UButton v-if="!isExisting" :href="`/api/admissions/${application.id}/pdf`" external color="neutral" variant="outline" icon="i-lucide-download">Download submitted PDF</UButton></section>
    <UAlert v-if="application.duplicates?.length" color="warning" title="Possible existing student" :description="`${application.duplicates.length} student record(s) use the same email or phone. Check before approving.`" />
    <div class="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div class="space-y-6">
        <UCard><template #header><h3 class="font-semibold">Student information</h3></template><div class="flex flex-col gap-6 sm:flex-row"><img :src="application.photoPath" alt="Applicant" class="h-48 w-36 rounded-xl object-cover"><dl class="grid flex-1 gap-4 sm:grid-cols-2"><InfoItem label="Name" :value="`${application.firstName} ${application.lastName}`" /><InfoItem label="Date of birth" :value="formatDate(application.dateOfBirth)" /><InfoItem label="Email" :value="application.email" /><InfoItem label="Phone" :value="application.phone" /><InfoItem label="Dojo" :value="application.dojo?.name" /><InfoItem label="Program" :value="application.program?.displayName || 'Not selected'" /><InfoItem label="Address" :value="address" /><InfoItem v-if="isExisting" label="Original joining date" :value="formatDate(application.originalJoinedAt)" /><InfoItem v-if="isExisting" label="Current belt" :value="application.currentBeltRank?.name || 'Not declared'" /><InfoItem v-if="isExisting" label="Membership number" :value="application.membershipNumber || 'Not provided'" /><InfoItem v-if="!isExisting" label="Preferred start" :value="application.preferredStartDate ? formatDate(application.preferredStartDate) : 'Not specified'" /></dl></div></UCard>
        <UCard><template #header><h3 class="font-semibold">Guardian, emergency, and medical</h3></template><dl class="grid gap-4 sm:grid-cols-2"><InfoItem label="Guardian" :value="application.guardianName || 'Not provided'" /><InfoItem label="Relationship" :value="application.guardianRelationship || '—'" /><InfoItem label="Guardian contact" :value="[application.guardianPhone, application.guardianEmail].filter(Boolean).join(' · ') || '—'" /><InfoItem label="Emergency contact" :value="`${application.emergencyContact} · ${application.emergencyPhone}`" /><InfoItem class="sm:col-span-2" label="Medical notes" :value="application.medicalNotes || 'None declared'" /><InfoItem class="sm:col-span-2" label="Previous experience" :value="application.previousExperience || 'None provided'" /></dl></UCard>
      </div>
      <aside class="space-y-6">
        <UCard><template #header><h3 class="font-semibold">Review actions</h3></template><div class="space-y-3">
          <UButton v-if="application.status === 'submitted'" block color="neutral" variant="outline" icon="i-lucide-eye" :loading="working" @click="review('start_review')">Start review</UButton>
          <UButton v-if="!isExisting && !application.physicalCopyReceivedAt && !finalized" block color="neutral" variant="outline" icon="i-lucide-file-check-2" :loading="working" @click="markPhysical">Mark physical copy received</UButton>
          <UAlert v-else-if="!isExisting && application.physicalCopyReceivedAt" color="success" title="Physical copy received" :description="`${formatDate(application.physicalCopyReceivedAt)}${application.physicalCopyReceiver?.name ? ` by ${application.physicalCopyReceiver.name}` : ''}`" />
          <div v-if="isExisting && !finalized" class="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <UFormField label="Record handling"><USelect v-model="approval.matchedStudentId" :items="matchOptions" class="w-full" /></UFormField>
            <UFormField label="Fee plan"><USelect v-model="approval.feePlanId" :items="feePlanOptions" class="w-full" placeholder="No fee plan yet" /></UFormField>
            <UFormField v-if="approval.feePlanId" label="Fee tracking starts" help="No dues are calculated before this date" required><UInput v-model="approval.feeStartDate" type="date" :min="registrationDate" class="w-full" required /></UFormField>
            <UCheckbox v-model="approval.grantPortalAccess" label="Create portal access after approval" />
          </div>
          <UButton v-if="!finalized" block color="success" icon="i-lucide-user-check" :loading="working" @click="approve">{{ isExisting ? 'Approve registration' : 'Approve and create student' }}</UButton>
          <UButton v-if="!finalized" block color="error" variant="soft" icon="i-lucide-circle-x" @click="toggleReject">Reject application</UButton>
          <div v-if="showReject" class="space-y-2"><UTextarea v-model="rejectionReason" class="w-full" placeholder="Reason for rejection" /><UButton block color="error" :loading="working" @click="review('reject')">Confirm rejection</UButton></div>
          <UButton v-if="application.resultingStudentId" :to="`/students/${application.resultingStudentId}`" block>Open student profile</UButton>
        </div></UCard>
        <UCard><template #header><h3 class="font-semibold">Internal notes</h3></template><UTextarea v-model="internalNotes" class="w-full" :rows="5" placeholder="Visible only to staff" /><UButton class="mt-3" block color="neutral" variant="outline" :loading="working" @click="review('save_notes')">Save notes</UButton></UCard>
        <UAlert v-if="!isExisting" color="info" title="Portal access stays off" description="Approval creates the student without credentials. Grant portal access separately from the student profile after approval." />
        <UAlert v-else color="info" title="Historical fees stay clear" description="Only the fee tracking start date above creates fee periods. The student's original joining date does not create past dues." />
        <UCard v-if="portalCredentials"><template #header><h3 class="font-semibold text-amber-700">Save portal credentials now</h3></template><p class="text-sm">These credentials are shown only in this approval response.</p><dl class="mt-3 space-y-2 text-sm"><InfoItem label="Username" :value="portalCredentials.username" /><InfoItem label="Temporary password" :value="portalCredentials.temporaryPassword" /></dl></UCard>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
const toast = useToast()
const { data: application, refresh } = await useFetch<any>(`/api/admissions/${route.params.id}`)
const { data: feePlans } = await useFetch<any[]>('/api/fee-plans', { default: () => [] })
const working = ref(false)
const showReject = ref(false)
const rejectionReason = ref('')
const internalNotes = ref(application.value?.internalNotes || '')
const portalCredentials = ref<any>(null)
const approval = reactive({ matchedStudentId: null as number | null, feePlanId: null as number | null, feeStartDate: new Date().toISOString().slice(0, 10), grantPortalAccess: true })
watch(application, value => { internalNotes.value = value?.internalNotes || '' })
const finalized = computed(() => ['approved', 'rejected'].includes(application.value?.status))
const isExisting = computed(() => application.value?.applicationType === 'existing')
const registrationDate = computed(() => application.value?.submittedAt ? new Date(application.value.submittedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
const matchOptions = computed(() => [{ label: 'Create a new student record', value: null }, ...(application.value?.duplicates || []).map((item: any) => ({ label: `Update #${item.id}: ${item.firstName} ${item.lastName}${item.email ? ` · ${item.email}` : ''}`, value: item.id }))])
const feePlanOptions = computed(() => [{ label: 'No fee plan yet', value: null }, ...(feePlans.value || []).filter((plan: any) => plan.isActive && (!plan.dojoId || plan.dojoId === application.value?.dojoId)).map((plan: any) => ({ label: plan.name, value: plan.id }))])
const badgeColor = computed(() => application.value?.status === 'approved' ? 'success' : application.value?.status === 'rejected' ? 'error' : application.value?.status === 'physical_received' ? 'info' : 'warning')
const address = computed(() => [application.value?.address, application.value?.city, application.value?.stateProvince, application.value?.postalCode, application.value?.country].filter(Boolean).join(', ') || 'Not provided')
const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
async function run(action: () => Promise<any>, success: string) { working.value = true; try { await action(); await refresh(); toast.add({ color: 'success', title: success }) } catch (error: any) { toast.add({ color: 'error', title: 'Action failed', description: error.data?.statusMessage || error.message }) } finally { working.value = false } }
async function review(action: 'start_review' | 'reject' | 'save_notes') { await run(() => $fetch(`/api/admissions/${route.params.id}/review`, { method: 'PATCH', body: { action, internalNotes: internalNotes.value, rejectionReason: rejectionReason.value } }), action === 'reject' ? 'Application rejected' : 'Review updated') }
async function markPhysical() { await run(() => $fetch(`/api/admissions/${route.params.id}/physical-copy`, { method: 'POST' }), 'Physical copy recorded') }
async function approve() { working.value = true; try { const result = await $fetch<any>(`/api/admissions/${route.params.id}/approve`, { method: 'POST', body: isExisting.value ? approval : undefined }); portalCredentials.value = result.portalCredentials; await refresh(); toast.add({ color: 'success', title: isExisting.value ? 'Existing student registration approved' : 'Admission approved and student created' }) } catch (error: any) { toast.add({ color: 'error', title: 'Action failed', description: error.data?.statusMessage || error.message }) } finally { working.value = false } }
function toggleReject() { showReject.value = !showReject.value }
</script>
