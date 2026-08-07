<template>
  <NuxtPage v-if="isChildRoute" />
  <div v-else class="mx-auto max-w-7xl">
    <div class="mb-6 flex items-center justify-between gap-3">
      <UButton to="/students" color="neutral" variant="ghost" icon="i-lucide-arrow-left">All students</UButton>
      <div class="flex flex-wrap gap-2"><UButton v-if="canManagePortalAccess" :to="`/students/${studentId}/portal-access`" color="neutral" variant="soft" icon="i-lucide-key-round">Portal access</UButton><UButton :href="`/api/students/${studentId}/progress-report`" target="_blank" color="neutral" variant="soft" icon="i-lucide-file-down">Progress report</UButton><UButton :to="`/grading-exams?studentId=${studentId}`" color="neutral" variant="soft" icon="i-lucide-award">Add to grading</UButton><UButton :to="`/fees?id=${studentId}`" color="primary" icon="i-lucide-circle-dollar-sign">Record payment</UButton></div>
    </div>

    <div v-if="pending" class="grid gap-5 lg:grid-cols-[280px_1fr]">
      <USkeleton class="h-72 rounded-3xl" />
      <USkeleton class="h-72 rounded-3xl" />
    </div>

    <UAlert v-else-if="error" color="error" title="Unable to load student" :description="error.message" />

    <template v-else-if="student">
      <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="h-24 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500" />
        <div class="relative px-5 pb-6 sm:px-7">
          <div class="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div class="flex items-end gap-4">
              <img v-if="student.avatar" :src="student.avatar" :alt="studentName" class="h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-md dark:border-slate-900">
              <div v-else class="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-slate-100 text-3xl font-semibold text-slate-500 shadow-md dark:border-slate-900 dark:bg-slate-800 dark:text-slate-300">
                {{ initials }}
              </div>
              <div class="pb-1">
                <p class="text-sm font-medium text-primary">Student profile</p>
                <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">{{ studentName }}</h2>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ student.dojo?.name || 'No dojo assigned' }}</p>
              </div>
            </div>
            <UBadge :color="student.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="capitalize">{{ student.status }}</UBadge>
          </div>

          <div class="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3 dark:border-slate-800">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Current rank</p>
              <p class="mt-1 font-medium">{{ student.currentBeltRank?.name || 'Not assigned' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Member since</p>
              <p class="mt-1 font-medium">{{ formatDate(student.joinedAt) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Contact</p>
              <p class="mt-1 truncate font-medium">{{ student.phone || student.email || 'Not provided' }}</p>
            </div>
          </div>
        </div>
      </section>

      <div class="mt-6 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        <div class="flex min-w-max gap-1">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition"
            :class="activeTab === tab.value ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
            @click="activeTab = tab.value"
          >
            <UIcon :name="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </button>
        </div>
      </div>

      <section class="mt-6">
        <div v-if="activeTab === 'overview'" class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <UCard>
            <template #header><h3 class="font-semibold">Student details</h3></template>
            <dl class="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <InfoItem label="Email" :value="student.email" />
              <InfoItem label="Phone" :value="student.phone" />
              <InfoItem label="Date of birth" :value="student.dateOfBirth ? formatDate(student.dateOfBirth) : undefined" />
              <InfoItem label="Gender" :value="student.gender" capitalize />
              <InfoItem label="Address" :value="student.address" />
              <InfoItem label="Emergency contact person" :value="student.emergencyContact" />
              <InfoItem label="Emergency phone" :value="student.emergencyPhone" />
              <InfoItem label="Medical notes" :value="student.medicalNotes" />
            </dl>
          </UCard>

          <UCard>
            <template #header><h3 class="font-semibold">At a glance</h3></template>
            <div class="space-y-4">
              <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p class="text-sm text-slate-500 dark:text-slate-400">Attendance records</p>
                <p class="mt-1 text-2xl font-semibold">{{ attendance.records?.length || 0 }}</p>
              </div>
              <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p class="text-sm text-slate-500 dark:text-slate-400">Fee assignments</p>
                <p class="mt-1 text-2xl font-semibold">{{ feeAssignments.length }}</p>
              </div>
              <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p class="text-sm text-slate-500 dark:text-slate-400">Documents on file</p>
                <p class="mt-1 text-2xl font-semibold">{{ documents.length }}</p>
              </div>
            </div>
          </UCard>
        </div>

        <UCard class="mt-6">
          <template #header><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">Programs</h3><p class="mt-1 text-sm text-slate-500">Add another program only when this student or client trains in more than one.</p></div><UButton size="sm" icon="i-lucide-plus" :loading="addingProgram" @click="addProgram">Add program</UButton></div></template>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><USelect v-model="newProgramId" :items="availableProgramOptions" placeholder="Choose an additional program" /><p class="self-center text-sm text-slate-500">One program is enough for most students.</p></div>
          <div v-if="programEnrollments.length" class="mt-4 divide-y divide-slate-100 dark:divide-slate-800"><div v-for="enrollment in programEnrollments" :key="enrollment.id" class="flex items-center justify-between gap-3 py-3"><div><p class="font-medium">{{ enrollment.program?.displayName }}</p><p class="mt-1 text-xs text-slate-500">Started {{ formatDate(enrollment.startDate) }}</p></div><UBadge :color="enrollment.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="capitalize">{{ enrollment.status }}</UBadge></div></div>
        </UCard>

        <UCard v-if="activeTab === 'attendance'">
          <template #header><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">Attendance history</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Review classes attended or share a complete report.</p></div><UButton size="sm" color="primary" variant="soft" icon="i-lucide-download" :loading="downloadingAttendanceReport" @click="downloadAttendanceReport">Download PDF</UButton></div></template>
          <div v-if="attendance.records?.length" class="divide-y divide-slate-100 dark:divide-slate-800">
            <div v-for="record in attendance.records" :key="record.id" class="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p class="font-medium">{{ record.className }}</p>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ formatDate(record.date) }} · {{ record.dojoName }} · {{ record.startTime }}</p>
              </div>
              <UBadge :color="attendanceColor(record.status)" variant="subtle" class="capitalize">{{ record.status }}</UBadge>
            </div>
          </div>
          <EmptyState v-else icon="i-lucide-calendar-x" message="No attendance has been recorded yet." />
        </UCard>

        <div v-if="activeTab === 'fees'" class="space-y-6">
          <UCard>
            <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><p class="text-sm font-semibold text-primary">SHAREABLE RECORD</p><h3 class="mt-1 font-semibold">Fee history statement</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Download a professional payment history and current balance to share with the student or guardian.</p></div>
              <div class="grid gap-3 sm:grid-cols-3"><UFormField label="Statement from"><UInput v-model="statementFrom" type="date" /></UFormField><UFormField label="Statement to"><UInput v-model="statementTo" type="date" /></UFormField><div class="self-end"><UButton color="primary" icon="i-lucide-eye" :loading="downloadingStatement" @click="downloadFeeStatement">Preview PDF</UButton></div></div>
            </div>
          </UCard>
          <UCard>
            <template #header><div><h3 class="font-semibold">Fee plan & recurring discount</h3><p class="mt-1 text-sm text-slate-500">Set the student’s plan and approved recurring discount here.</p></div></template>
            <form class="mb-5 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800" @submit.prevent="saveFeeAssignment">
              <UFormField label="Fee plan" required><USelect v-model="feeAssignmentForm.feePlanId" :items="feePlanOptions" :disabled="!!editingAssignmentId" class="min-w-52" :ui="{ content: 'min-w-52' }" required /></UFormField><UFormField label="Start date" required><UInput v-model="feeAssignmentForm.startDate" type="date" required /></UFormField><UFormField label="Recurring discount"><UInput v-model.number="feeAssignmentForm.discount" type="number" min="0" step="0.01" placeholder="0.00" /></UFormField><UFormField label="Discount reason" :required="feeAssignmentForm.discount > 0"><UInput v-model="feeAssignmentForm.discountReason" placeholder="Required when discounted" /></UFormField><div class="flex gap-2 sm:col-span-2 lg:col-span-4"><UButton type="submit" :loading="savingFeeAssignment">{{ editingAssignmentId ? 'Save fee terms' : 'Assign fee plan' }}</UButton><UButton v-if="editingAssignmentId" type="button" color="neutral" variant="ghost" @click="resetFeeAssignmentForm">Cancel</UButton></div>
            </form>
            <div v-if="feeAssignments.length" class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800"><tr><th class="px-3 py-3">Plan</th><th class="px-3 py-3">Start date</th><th class="px-3 py-3">Discount</th><th class="px-3 py-3">Net amount</th><th class="px-3 py-3">Outstanding</th><th class="px-3 py-3">Status</th><th></th></tr></thead>
                <tbody><tr v-for="assignment in feeAssignments" :key="assignment.id" class="border-b border-slate-100 last:border-0 dark:border-slate-800"><td class="px-3 py-4"><p class="font-medium">{{ assignment.feePlan?.name }}</p><p class="mt-1 text-xs text-slate-400">{{ feePlanScopeLabel(assignment.feePlan) }}</p></td><td class="px-3 py-4">{{ formatDate(assignment.startDate) }}</td><td class="px-3 py-4"><p>{{ formatCurrency(assignment.discount || 0) }}</p><p class="mt-1 text-xs text-slate-400">{{ assignment.discountReason || '—' }}</p></td><td class="px-3 py-4">{{ formatCurrency(assignment.netAmount) }}</td><td class="px-3 py-4" :class="assignment.outstanding > 0 ? 'font-medium text-amber-600 dark:text-amber-400' : ''">{{ formatCurrency(assignment.outstanding) }}</td><td class="px-3 py-4"><UBadge :color="assignment.status === 'active' ? 'success' : 'neutral'" variant="subtle" class="capitalize">{{ assignment.status }}</UBadge></td><td><UButton size="xs" variant="ghost" @click="editFeeAssignment(assignment)">Edit</UButton></td></tr></tbody>
              </table>
            </div>
            <EmptyState v-else icon="i-lucide-wallet-cards" message="No fee plan is assigned to this student." />
          </UCard>
          <UCard v-for="assignment in feeAssignments" :key="`ledger-${assignment.id}`">
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><h3 class="font-semibold">Fee-period ledger</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ assignment.feePlan?.name }} · Payments are matched to their recorded fee period.</p></div>
                <div class="flex flex-wrap gap-2"><UBadge :color="assignment.ledger?.firstUnpaidPeriod ? 'warning' : 'success'" variant="subtle">{{ assignment.ledger?.firstUnpaidLabel ? `First unpaid: ${assignment.ledger.firstUnpaidLabel}` : 'All due periods paid' }}</UBadge><UBadge color="neutral" variant="subtle">Credit: {{ formatCurrency(assignment.ledger?.creditAmount || 0) }}</UBadge></div>
              </div>
            </template>
            <div v-if="assignment.ledger?.periods?.length" class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800"><tr><th class="px-3 py-3">Fee period</th><th class="px-3 py-3">Due</th><th class="px-3 py-3">Paid</th><th class="px-3 py-3">Period balance</th><th class="px-3 py-3">Running balance</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Receipts</th></tr></thead>
                <tbody><tr v-for="period in assignment.ledger.periods" :key="period.key" class="border-b border-slate-100 last:border-0 dark:border-slate-800"><td class="px-3 py-4 font-medium">{{ period.label }}</td><td class="px-3 py-4">{{ formatCurrency(period.amountDue) }}</td><td class="px-3 py-4">{{ formatCurrency(period.paidAmount) }}</td><td class="px-3 py-4" :class="period.outstandingAmount ? 'font-medium text-amber-600 dark:text-amber-400' : ''">{{ formatCurrency(period.outstandingAmount) }}</td><td class="px-3 py-4" :class="period.runningBalance > 0 ? 'text-amber-600 dark:text-amber-400' : period.runningBalance < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''">{{ formatCurrency(period.runningBalance) }}</td><td class="px-3 py-4"><UBadge :color="feePeriodStatusColor(period.status)" variant="subtle">{{ feePeriodStatusLabel(period.status) }}</UBadge></td><td class="px-3 py-4"><div class="flex flex-wrap gap-1"><UButton v-for="receipt in period.payments" :key="receipt.id" :href="`/api/payments/${receipt.id}/receipt`" external size="xs" color="primary" variant="soft" icon="i-lucide-download">{{ receipt.receiptNumber }}</UButton><span v-if="!period.payments.length" class="text-slate-400">—</span></div></td></tr></tbody>
              </table>
            </div>
            <EmptyState v-else icon="i-lucide-calendar-range" message="No fee periods are available yet." />
          </UCard>
          <UCard>
            <template #header><div><h3 class="font-semibold">Payment history</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Receipts and their recorded fee periods.</p></div></template>
            <div v-if="payments.length" class="divide-y divide-slate-100 dark:divide-slate-800"><div v-for="payment in payments" :key="payment.id" class="py-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="font-medium">{{ formatCurrency(payment.amount) }}</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ formatDate(payment.paymentDate) }} · {{ payment.assignment?.feePlan?.name || 'Unassigned payment' }} · Fee period: {{ formatPaymentPeriod(payment) }}<span v-if="payment.feeItems?.length"> · {{ payment.feeItems.length }} additional fee{{ payment.feeItems.length === 1 ? '' : 's' }}</span></p></div><div class="flex items-center gap-2"><UBadge color="neutral" variant="subtle" class="capitalize">{{ payment.method }}</UBadge><UButton :href="`/api/payments/${payment.id}/receipt`" external size="xs" color="primary" variant="soft" icon="i-lucide-download">PDF</UButton><UButton v-if="canManageFinance && payment.assignmentId" size="xs" color="neutral" variant="ghost" icon="i-lucide-calendar-cog" @click="beginBillingPeriodCorrection(payment)">Correct period</UButton></div></div><form v-if="editingPaymentPeriodId === payment.id" class="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] dark:border-amber-900 dark:bg-amber-950/20" @submit.prevent="correctBillingPeriod(payment)"><UFormField label="Correct fee period" required><UInput v-model="billingPeriodCorrection.billingPeriod" type="month" required /></UFormField><UFormField label="Reason for correction" required><UInput v-model="billingPeriodCorrection.reason" maxlength="500" placeholder="Required for the audit log" required /></UFormField><div class="flex items-end gap-2"><UButton type="submit" :loading="correctingBillingPeriod">Save correction</UButton><UButton type="button" color="neutral" variant="ghost" @click="cancelBillingPeriodCorrection">Cancel</UButton></div></form></div></div>
            <EmptyState v-else icon="i-lucide-receipt-text" message="No payments have been recorded yet." />
          </UCard>
        </div>

        <UCard v-if="activeTab === 'achievements'">
          <template #header><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">Tournament achievements</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Record competition participation, results, medals, and certificates.</p></div><UButton size="sm" color="primary" icon="i-lucide-trophy" @click="showAchievementForm = !showAchievementForm; void 0">Record achievement</UButton></div></template>
          <form v-if="showAchievementForm" class="mb-5 grid gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="recordAchievement">
            <UFormField label="Tournament name" required><UInput v-model="achievementForm.tournamentName" placeholder="Tournament name" /></UFormField>
            <UFormField label="Tournament level" required><UInput v-model="achievementForm.tournamentLevel" placeholder="e.g. District, State" /></UFormField>
            <UFormField label="Venue"><UInput v-model="achievementForm.venue" placeholder="City or venue" /></UFormField>
            <UFormField label="Start date" required><UInput v-model="achievementForm.startDate" type="date" /></UFormField>
            <UFormField label="End date"><UInput v-model="achievementForm.endDate" type="date" /></UFormField>
            <UFormField label="Event"><UInput v-model="achievementForm.eventType" placeholder="e.g. Kata, Kumite, Both" /></UFormField>
            <UFormField label="Age category"><UInput v-model="achievementForm.ageCategory" placeholder="Your category label" /></UFormField>
            <UFormField label="Weight category"><UInput v-model="achievementForm.weightCategory" placeholder="Optional weight class" /></UFormField>
            <UFormField label="Result"><UInput v-model="achievementForm.result" placeholder="e.g. 1st place" /></UFormField>
            <UFormField label="Medal awarded"><UInput v-model="achievementForm.medalType" placeholder="e.g. Gold, Silver, Bronze" /></UFormField>
            <UFormField label="Medals won"><UInput v-model.number="achievementForm.medalsWon" type="number" min="0" step="1" /></UFormField>
            <UFormField label="Certificate"><UInput type="file" accept="application/pdf,image/*" @change="onAchievementCertificateChange" /></UFormField>
            <UFormField label="Notes" class="sm:col-span-2 lg:col-span-3"><UTextarea v-model="achievementForm.notes" placeholder="Optional notes" /></UFormField>
            <div class="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><UButton color="neutral" variant="ghost" @click="showAchievementForm = false; void 0">Cancel</UButton><UButton type="submit" color="primary" :loading="savingAchievement">Save achievement</UButton></div>
          </form>
          <div v-if="achievements.length" class="space-y-3"><div v-for="achievement in achievements" :key="achievement.id" class="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div class="flex items-start justify-between gap-3"><div><p class="font-medium">{{ achievement.tournamentName }}</p><p class="mt-1 text-sm text-primary">{{ achievement.tournamentLevel }}<span v-if="achievement.venue"> · {{ achievement.venue }}</span></p></div><div class="flex items-center gap-2"><a v-if="achievement.certificateUrl" :href="achievement.certificateUrl" target="_blank"><UButton size="xs" color="neutral" variant="soft" icon="i-lucide-file-badge">Certificate</UButton></a><UButton size="xs" color="primary" variant="soft" icon="i-lucide-file-down" @click="downloadAchievementCard(achievement.id)">Card</UButton><UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="deleteAchievement(achievement.id)" /></div></div><div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300"><span>{{ formatDate(achievement.startDate) }}<template v-if="achievement.endDate"> – {{ formatDate(achievement.endDate) }}</template></span><span v-if="achievement.eventType">{{ achievement.eventType }}</span><span v-if="achievement.ageCategory">{{ achievement.ageCategory }}</span><span v-if="achievement.weightCategory">{{ achievement.weightCategory }}</span><span v-if="achievement.result" class="font-medium">{{ achievement.result }}</span><span v-if="achievement.medalType" class="font-medium">{{ achievement.medalType }}</span><span v-if="achievement.medalsWon">{{ achievement.medalsWon }} medal{{ achievement.medalsWon === 1 ? '' : 's' }}</span></div><p v-if="achievement.notes" class="mt-3 text-sm">{{ achievement.notes }}</p></div></div>
          <EmptyState v-else icon="i-lucide-trophy" message="No tournament achievements have been recorded yet." />
        </UCard>

        <UCard v-if="activeTab === 'guardians'">
          <template #header><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">Guardians & emergency contacts</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep the people responsible for this student easy to reach.</p></div><UButton size="sm" color="primary" icon="i-lucide-user-plus" @click="toggleGuardianForm">Add guardian</UButton></div></template>
          <form v-if="showGuardianForm" class="mb-5 grid gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2" @submit.prevent="addGuardian">
            <UFormField label="Full name" required><UInput v-model="guardianForm.name" placeholder="Guardian name" /></UFormField>
            <UFormField label="Relationship" required><UInput v-model="guardianForm.relationship" placeholder="e.g. Parent, sibling" /></UFormField>
            <UFormField label="Phone"><UInput v-model="guardianForm.phone" type="tel" placeholder="Phone number" /></UFormField>
            <UFormField label="Email"><UInput v-model="guardianForm.email" type="email" placeholder="Email address" /></UFormField>
            <UFormField label="Address" class="sm:col-span-2"><UInput v-model="guardianForm.address" placeholder="Address (optional)" /></UFormField>
            <div class="flex justify-end gap-2 sm:col-span-2"><UButton color="neutral" variant="ghost" @click="toggleGuardianForm">Cancel</UButton><UButton type="submit" color="primary" :loading="savingGuardian">Save guardian</UButton></div>
          </form>
          <div v-if="guardians.length" class="grid gap-4 md:grid-cols-2"><div v-for="guardian in guardians" :key="guardian.id" class="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p class="font-medium">{{ guardian.name }}</p><p class="mt-1 text-sm capitalize text-primary">{{ guardian.relationship }}</p><p class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ guardian.phone || 'No phone' }}<br>{{ guardian.email || 'No email' }}</p></div></div>
          <EmptyState v-else icon="i-lucide-contact-round" message="No guardians have been added yet." />
        </UCard>

        <UCard v-if="activeTab === 'documents'">
          <template #header><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">Documents</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Store identity documents and supporting files securely.</p></div><UButton size="sm" color="primary" icon="i-lucide-upload" @click="toggleDocumentForm">Upload document</UButton></div></template>
          <form v-if="showDocumentForm" class="mb-5 grid gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2" @submit.prevent="uploadDocument">
            <UFormField label="Document type" required><USelect v-model="documentForm.documentType" :items="documentTypeOptions" /></UFormField>
            <UFormField label="Document number"><UInput v-model="documentForm.documentNumber" placeholder="Optional number" /></UFormField>
            <UFormField label="File" required><UInput type="file" accept="application/pdf,image/*" @change="onDocumentFileChange" /></UFormField>
            <UFormField label="Notes"><UInput v-model="documentForm.notes" placeholder="Optional note" /></UFormField>
            <p class="text-xs text-slate-500 sm:col-span-2">PDF, JPG, PNG, GIF, WEBP, or SVG · maximum 5 MB.</p>
            <div class="flex justify-end gap-2 sm:col-span-2"><UButton color="neutral" variant="ghost" @click="toggleDocumentForm">Cancel</UButton><UButton type="submit" color="primary" :loading="uploadingDocument">Upload document</UButton></div>
          </form>
          <div v-if="documents.length" class="divide-y divide-slate-100 dark:divide-slate-800"><a v-for="document in documents" :key="document.id" :href="document.fileUrl" target="_blank" class="flex items-center justify-between gap-3 py-4 hover:text-primary"><div class="flex items-center gap-3"><UIcon name="i-lucide-file-text" class="h-5 w-5 text-primary" /><div><p class="font-medium capitalize">{{ document.documentType.replaceAll('_', ' ') }}</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ document.documentNumber || 'No document number' }}</p></div></div><UIcon name="i-lucide-external-link" class="h-4 w-4" /></a></div>
          <EmptyState v-else icon="i-lucide-files" message="No documents have been uploaded yet." />
        </UCard>

        <UCard v-else>
          <template #header><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">Grading history</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Record milestones and keep a complete progression history.</p></div><UButton size="sm" color="primary" icon="i-lucide-award" @click="openNewGrading">Record grading</UButton></div></template>
          <form v-if="showGradingForm" class="mb-5 grid gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2" @submit.prevent="recordGrading">
            <UFormField label="Awarded rank" required><USelect v-model="gradingForm.beltRankId" :items="beltRankOptions" placeholder="Select a rank" /></UFormField>
            <UFormField label="Awarded date" required><UInput v-model="gradingForm.awardedDate" type="date" /></UFormField>
            <UFormField label="Examiner"><UInput v-model="gradingForm.examiner" placeholder="Instructor or examiner" /></UFormField>
            <UFormField label="Certificate number"><UInput v-model="gradingForm.certificateNumber" placeholder="e.g. KGI-2026-00124" /></UFormField>
            <UFormField label="Certificate"><UInput type="file" accept="application/pdf,image/*" @change="onCertificateFileChange" /></UFormField>
            <UFormField label="Notes" class="sm:col-span-2"><UTextarea v-model="gradingForm.notes" placeholder="Assessment notes (optional)" /></UFormField>
            <div class="flex justify-end gap-2 sm:col-span-2"><UButton color="neutral" variant="ghost" @click="cancelGradingEdit">Cancel</UButton><UButton type="submit" color="primary" :loading="savingGrading">{{ editingGradingId ? 'Save changes' : 'Save grading' }}</UButton></div>
          </form>
          <div v-if="gradings.length" class="space-y-4"><div v-for="grading in gradings" :key="grading.id" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div class="flex items-start justify-between gap-3"><div><p class="font-semibold">{{ grading.beltRank?.name || 'Rank awarded' }}</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Awarded on {{ formatDate(grading.awardedDate) }}</p></div><div class="flex gap-2"><a v-if="grading.certificateUrl" :href="grading.certificateUrl" target="_blank"><UButton size="xs" color="neutral" variant="soft" icon="i-lucide-file-badge">Certificate</UButton></a><UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click="editGrading(grading)">Edit</UButton></div></div><dl class="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 dark:border-slate-800"><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Awarded rank</dt><dd class="mt-1 font-medium">{{ grading.beltRank?.name || 'Not recorded' }}</dd></div><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Awarded date</dt><dd class="mt-1 font-medium">{{ formatDate(grading.awardedDate) }}</dd></div><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Examiner</dt><dd class="mt-1">{{ grading.examiner || 'Not recorded' }}</dd></div><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Certificate number</dt><dd class="mt-1">{{ grading.certificateNumber || 'Not recorded' }}</dd></div><div class="sm:col-span-2"><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</dt><dd class="mt-1 whitespace-pre-wrap">{{ grading.notes || 'No notes recorded' }}</dd></div></dl></div></div>
          <EmptyState v-else icon="i-lucide-award" message="No gradings have been recorded yet." />
        </UCard>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const { user } = useUserSession()
const portalManagerRoles = ['owner', 'admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head']
const { data: accessProfile } = await useFetch<{ assignments?: Array<{ role: string }> }>('/api/user/profile')
const canManagePortalAccess = computed(() =>
  portalManagerRoles.includes(user.value?.role || '')
  || (accessProfile.value?.assignments || []).some(assignment => portalManagerRoles.includes(assignment.role))
)
const canManageFinance = computed(() =>
  portalManagerRoles.includes(user.value?.role || '')
  || (accessProfile.value?.assignments || []).some(assignment => portalManagerRoles.includes(assignment.role))
)
const isChildRoute = computed(() => route.path !== `/students/${route.params.id}`)
const toast = useToast()
const studentId = Number(route.params.id)
const activeTab = ref('overview')
const statementFrom = ref('')
const statementTo = ref('')
const downloadingStatement = ref(false)
const downloadingAttendanceReport = ref(false)
const showGuardianForm = ref(false)
const savingGuardian = ref(false)
const showDocumentForm = ref(false)
const uploadingDocument = ref(false)
const showGradingForm = ref(false)
const savingGrading = ref(false)
const editingGradingId = ref<number | null>(null)
const showAchievementForm = ref(false)
const savingAchievement = ref(false)
const guardianForm = reactive({ name: '', relationship: '', phone: '', email: '', address: '' })
const documentForm = reactive({ documentType: 'other', documentNumber: '', notes: '', file: null as File | null })
const gradingForm = reactive({ beltRankId: undefined as number | undefined, awardedDate: new Date().toISOString().slice(0, 10), examiner: '', certificateNumber: '', notes: '', certificate: null as File | null })
const achievementForm = reactive({ tournamentName: '', tournamentLevel: '', venue: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', eventType: '', ageCategory: '', weightCategory: '', result: '', medalType: '', medalsWon: 0, notes: '', certificate: null as File | null })
const documentTypeOptions = [
  { label: 'National ID', value: 'national_id' },
  { label: 'Passport', value: 'passport' },
  { label: 'Driving licence', value: 'driving_license' },
  { label: 'Voter registration', value: 'voter_registration' },
  { label: 'Other document', value: 'other' },
]
const tabs = [
  { value: 'overview', label: 'Overview', icon: 'i-lucide-layout-panel-top' },
  { value: 'attendance', label: 'Attendance', icon: 'i-lucide-calendar-check-2' },
  { value: 'fees', label: 'Fees', icon: 'i-lucide-wallet-cards' },
  { value: 'achievements', label: 'Achievements', icon: 'i-lucide-trophy' },
  { value: 'guardians', label: 'Guardians', icon: 'i-lucide-contact-round' },
  { value: 'documents', label: 'Documents', icon: 'i-lucide-files' },
  { value: 'gradings', label: 'Gradings', icon: 'i-lucide-award' },
]

const { data: student, pending, error, refresh: refreshStudent } = await useFetch<any>(`/api/students/${studentId}`)
const { data: programEnrollmentData, refresh: refreshProgramEnrollments } = await useAsyncData(`student-${studentId}-program-enrollments`, () => $fetch<any[]>(`/api/students/${studentId}/program-enrollments`))
const { data: programs } = await useFetch<any[]>('/api/organization/programs')
const { data: attendanceData } = await useAsyncData(`student-${studentId}-attendance`, () => $fetch<any>(`/api/students/${studentId}/attendance`))
const { data: feeAssignmentData, refresh: refreshFeeAssignments } = await useAsyncData(`student-${studentId}-fee-assignments`, () => $fetch<any[]>(`/api/students/${studentId}/fee-assignments`))
const { data: paymentData, refresh: refreshPayments } = await useAsyncData(`student-${studentId}-payments`, () => $fetch<any[]>(`/api/students/${studentId}/payments`))
const { data: guardianData, refresh: refreshGuardians } = await useAsyncData(`student-${studentId}-guardians`, () => $fetch<any[]>(`/api/students/${studentId}/guardians`))
const { data: documentData, refresh: refreshDocuments } = await useAsyncData(`student-${studentId}-documents`, () => $fetch<any[]>(`/api/students/${studentId}/documents`))
const { data: gradingData, refresh: refreshGradings } = await useAsyncData(`student-${studentId}-gradings`, () => $fetch<any[]>(`/api/students/${studentId}/gradings`))
const { data: achievementData, refresh: refreshAchievements } = await useAsyncData(`student-${studentId}-achievements`, () => $fetch<any[]>(`/api/students/${studentId}/achievements`))
const { data: beltRankData } = await useFetch<any[]>('/api/belt-ranks')
const { data: feePlanData } = await useFetch<any[]>('/api/fee-plans')
const { data: organization } = await useFetch<{ currency?: string }>('/api/organization/settings')
const savingFeeAssignment = ref(false)
const editingAssignmentId = ref<number | null>(null)
const feeAssignmentForm = reactive({ feePlanId: null as number | null, startDate: new Date().toISOString().slice(0, 10), discount: 0, discountReason: '' })
const editingPaymentPeriodId = ref<number | null>(null)
const correctingBillingPeriod = ref(false)
const billingPeriodCorrection = reactive({ billingPeriod: '', reason: '' })

const attendance = computed(() => attendanceData.value || { records: [] })
const feeAssignments = computed(() => feeAssignmentData.value || [])
const programEnrollments = computed(() => programEnrollmentData.value || [])
const newProgramId = ref<number | null>(null)
const addingProgram = ref(false)
const availableProgramOptions = computed(() => (programs.value || []).filter(program => !programEnrollments.value.some((enrollment: any) => enrollment.programId === program.id && enrollment.status === 'active')).map(program => ({ label: program.displayName, value: program.id })))
const payments = computed(() => paymentData.value || [])
const guardians = computed(() => guardianData.value || [])
const documents = computed(() => documentData.value || [])
const gradings = computed(() => gradingData.value || [])
onMounted(() => {
  refreshGradings()
  refreshStudent()
})
const achievements = computed(() => achievementData.value || [])
const beltRankOptions = computed(() => (beltRankData.value || []).map(rank => ({ label: rank.name, value: rank.id })))
function feePlanScopeLabel(plan: any) {
  if (plan?.dojo?.name) return `Dojo: ${plan.dojo.name}`
  if (plan?.scopeNode?.name) return `Territory: ${plan.scopeNode.name}`
  return 'All dojos'
}
const feePlanOptions = computed(() => (feePlanData.value || []).filter((plan: any) => plan.isActive).map((plan: any) => ({ label: `${plan.name} (${formatCurrency(plan.amount)}) — ${feePlanScopeLabel(plan)}`, value: plan.id })))
const studentName = computed(() => student.value ? `${student.value.firstName} ${student.value.lastName}` : '')
const initials = computed(() => studentName.value.split(' ').map((name: string) => name[0]).join('').slice(0, 2))

function resetFeeAssignmentForm() { Object.assign(feeAssignmentForm, { feePlanId: null, startDate: new Date().toISOString().slice(0, 10), discount: 0, discountReason: '' }); editingAssignmentId.value = null }
function editFeeAssignment(assignment: any) { editingAssignmentId.value = assignment.id; Object.assign(feeAssignmentForm, { feePlanId: assignment.feePlanId, startDate: new Date(assignment.startDate).toISOString().slice(0, 10), discount: (assignment.discount || 0) / 100, discountReason: assignment.discountReason || '' }) }
async function addProgram() { if (!newProgramId.value) { toast.add({ color: 'warning', title: 'Choose a program' }); return }; addingProgram.value = true; try { await $fetch(`/api/students/${studentId}/program-enrollments`, { method: 'POST', body: { programId: newProgramId.value } }); newProgramId.value = null; await refreshProgramEnrollments(); toast.add({ color: 'success', title: 'Program added' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not add program', description: error.data?.statusMessage || error.message }) } finally { addingProgram.value = false } }
async function saveFeeAssignment() { if (!editingAssignmentId.value && !feeAssignmentForm.feePlanId) return; if (feeAssignmentForm.discount > 0 && !feeAssignmentForm.discountReason.trim()) { toast.add({ color: 'warning', title: 'Enter a discount reason' }); return }; savingFeeAssignment.value = true; try { const body = editingAssignmentId.value ? { startDate: feeAssignmentForm.startDate, discount: Math.round(feeAssignmentForm.discount * 100), discountReason: feeAssignmentForm.discountReason || null } : { feePlanId: feeAssignmentForm.feePlanId, startDate: feeAssignmentForm.startDate, discount: Math.round(feeAssignmentForm.discount * 100), discountReason: feeAssignmentForm.discountReason || undefined }; await $fetch(editingAssignmentId.value ? `/api/students/${studentId}/fee-assignments/${editingAssignmentId.value}` : `/api/students/${studentId}/fee-assignments`, { method: editingAssignmentId.value ? 'PATCH' : 'POST', body }); await refreshFeeAssignments(); resetFeeAssignmentForm(); toast.add({ color: 'success', title: 'Fee terms saved' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not save fee terms', description: error.data?.statusMessage || error.message }) } finally { savingFeeAssignment.value = false } }

function formatDate(value?: number | string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Not provided'
}

function formatCurrency(amount?: number) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: organization.value?.currency || 'USD' }).format((amount || 0) / 100) }

function formatPaymentPeriod(payment: any) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payment.billingPeriod || '')) return 'Legacy / not specified'
  const [year, month] = payment.billingPeriod.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const label = (date: Date) => date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const frequency = payment.assignment?.feePlan?.frequency
  const months = frequency === 'quarterly' ? 3 : frequency === 'half-annually' ? 6 : frequency === 'annual' ? 12 : 1
  if (frequency === 'one-time') return `One-time · ${label(start)}`
  if (months === 1) return label(start)
  const end = new Date(Date.UTC(year, month + months - 2, 1))
  return `${label(start)} – ${label(end)}`
}

function feePeriodStatusLabel(status: string) {
  return ({ paid_in_advance: 'Paid in advance', paid: 'Paid', partially_paid: 'Partially paid', overdue: 'Overdue', due: 'Due' } as Record<string, string>)[status] || status
}

function feePeriodStatusColor(status: string): 'success' | 'error' | 'warning' {
  return status === 'paid' || status === 'paid_in_advance' ? 'success' : status === 'overdue' ? 'error' : 'warning'
}

function beginBillingPeriodCorrection(payment: any) {
  editingPaymentPeriodId.value = payment.id
  billingPeriodCorrection.billingPeriod = payment.billingPeriod || new Date(payment.paymentDate).toISOString().slice(0, 7)
  billingPeriodCorrection.reason = ''
}

function cancelBillingPeriodCorrection() {
  editingPaymentPeriodId.value = null
  billingPeriodCorrection.billingPeriod = ''
  billingPeriodCorrection.reason = ''
}

async function correctBillingPeriod(payment: any) {
  if (!billingPeriodCorrection.billingPeriod || billingPeriodCorrection.reason.trim().length < 3) {
    toast.add({ color: 'warning', title: 'Choose a fee period and enter a brief reason' })
    return
  }
  correctingBillingPeriod.value = true
  try {
    await $fetch(`/api/payments/${payment.id}/billing-period`, {
      method: 'PATCH',
      body: { billingPeriod: billingPeriodCorrection.billingPeriod, reason: billingPeriodCorrection.reason.trim() },
    })
    await Promise.all([refreshPayments(), refreshFeeAssignments()])
    cancelBillingPeriodCorrection()
    toast.add({ color: 'success', title: 'Fee period corrected', description: 'The ledger and audit log have been updated.' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not correct fee period', description: error.data?.statusMessage || error.message })
  } finally {
    correctingBillingPeriod.value = false
  }
}

function attendanceColor(status: string) {
  return status === 'present' ? 'success' : status === 'late' ? 'warning' : status === 'excused' ? 'neutral' : 'error'
}

async function downloadFeeStatement() {
  if (downloadingStatement.value) return
  const preview = window.open('', '_blank')
  downloadingStatement.value = true
  try {
    const params = new URLSearchParams()
    if (statementFrom.value) params.set('from', statementFrom.value)
    if (statementTo.value) params.set('to', statementTo.value)
    const response = await fetch(`/api/students/${studentId}/fee-report?${params.toString()}`)
    if (!response.ok) throw new Error((await response.text()) || 'Failed to generate fee statement')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    if (preview) preview.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error: any) {
    preview?.close()
    toast.add({ color: 'error', title: 'Could not download fee statement', description: error.message })
  } finally {
    downloadingStatement.value = false
  }
}

async function downloadAttendanceReport() {
  if (downloadingAttendanceReport.value) return
  const preview = window.open('', '_blank')
  downloadingAttendanceReport.value = true
  try {
    const response = await fetch(`/api/reports/attendance/student/${studentId}`)
    if (!response.ok) throw new Error((await response.text()) || 'Failed to generate attendance report')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    if (preview) preview.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error: any) {
    preview?.close()
    toast.add({ color: 'error', title: 'Could not download attendance report', description: error.message })
  } finally {
    downloadingAttendanceReport.value = false
  }
}

function toggleGuardianForm() {
  showGuardianForm.value = !showGuardianForm.value
}

function toggleDocumentForm() {
  showDocumentForm.value = !showDocumentForm.value
}

function resetGradingForm() {
  Object.assign(gradingForm, { beltRankId: undefined, awardedDate: new Date().toISOString().slice(0, 10), examiner: '', certificateNumber: '', notes: '', certificate: null })
}

function openNewGrading() {
  editingGradingId.value = null
  resetGradingForm()
  showGradingForm.value = true
}

function cancelGradingEdit() {
  editingGradingId.value = null
  resetGradingForm()
  showGradingForm.value = false
}

function editGrading(grading: any) {
  editingGradingId.value = grading.id
  Object.assign(gradingForm, {
    beltRankId: grading.beltRankId,
    awardedDate: new Date(grading.awardedDate).toISOString().slice(0, 10),
    examiner: grading.examiner || '',
    certificateNumber: grading.certificateNumber || '',
    notes: grading.notes || '',
    certificate: null,
  })
  showGradingForm.value = true
}

function onDocumentFileChange(event: Event) {
  documentForm.file = (event.target as HTMLInputElement).files?.item(0) || null
}

function onCertificateFileChange(event: Event) {
  gradingForm.certificate = (event.target as HTMLInputElement).files?.item(0) || null
}

function onAchievementCertificateChange(event: Event) {
  achievementForm.certificate = (event.target as HTMLInputElement).files?.item(0) || null
}

async function recordAchievement() {
  if (!achievementForm.tournamentName.trim() || !achievementForm.tournamentLevel.trim() || !achievementForm.startDate) {
    toast.add({ color: 'warning', title: 'Tournament name, level, and start date are required' })
    return
  }
  savingAchievement.value = true
  try {
    const formData = new FormData()
    for (const [key, value] of Object.entries(achievementForm)) {
      if (key !== 'certificate' && value !== '' && value !== null) formData.append(key, String(value))
    }
    if (achievementForm.certificate) formData.append('certificate', achievementForm.certificate)
    await $fetch(`/api/students/${studentId}/achievements`, { method: 'POST', body: formData })
    Object.assign(achievementForm, { tournamentName: '', tournamentLevel: '', venue: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', eventType: '', ageCategory: '', weightCategory: '', result: '', medalType: '', medalsWon: 0, notes: '', certificate: null })
    showAchievementForm.value = false
    await refreshAchievements()
    toast.add({ color: 'success', title: 'Achievement recorded' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not record achievement', description: error.data?.statusMessage || error.message })
  } finally {
    savingAchievement.value = false
  }
}

async function deleteAchievement(id: number) {
  if (!confirm('Delete this achievement record?')) return
  try {
    await $fetch(`/api/students/${studentId}/achievements/${id}`, { method: 'DELETE' })
    await refreshAchievements()
    toast.add({ color: 'success', title: 'Achievement deleted' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not delete achievement', description: error.data?.statusMessage || error.message })
  }
}

async function downloadAchievementCard(id: number) {
  try {
    const response = await fetch(`/api/students/${studentId}/achievements/${id}/report`)
    if (!response.ok) throw new Error((await response.text()) || 'Could not generate achievement card')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = `achievement_${studentName.value.replaceAll(' ', '_')}.pdf`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not download achievement card', description: error.message })
  }
}

async function addGuardian() {
  if (!guardianForm.name.trim() || !guardianForm.relationship.trim()) {
    toast.add({ color: 'warning', title: 'Guardian name and relationship are required' })
    return
  }
  savingGuardian.value = true
  try {
    await $fetch(`/api/students/${studentId}/guardians`, {
      method: 'POST',
      body: {
        name: guardianForm.name.trim(), relationship: guardianForm.relationship.trim(),
        phone: guardianForm.phone.trim() || undefined, email: guardianForm.email.trim() || undefined, address: guardianForm.address.trim() || undefined,
      },
    })
    Object.assign(guardianForm, { name: '', relationship: '', phone: '', email: '', address: '' })
    showGuardianForm.value = false
    await refreshGuardians()
    toast.add({ color: 'success', title: 'Guardian added' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not add guardian', description: error.data?.statusMessage || error.message })
  } finally {
    savingGuardian.value = false
  }
}

async function uploadDocument() {
  if (!documentForm.file) {
    toast.add({ color: 'warning', title: 'Choose a document to upload' })
    return
  }
  uploadingDocument.value = true
  try {
    const formData = new FormData()
    formData.append('documentType', documentForm.documentType)
    formData.append('file', documentForm.file)
    if (documentForm.documentNumber.trim()) formData.append('documentNumber', documentForm.documentNumber.trim())
    if (documentForm.notes.trim()) formData.append('notes', documentForm.notes.trim())
    await $fetch(`/api/students/${studentId}/documents`, { method: 'POST', body: formData })
    Object.assign(documentForm, { documentType: 'other', documentNumber: '', notes: '', file: null })
    showDocumentForm.value = false
    await refreshDocuments()
    toast.add({ color: 'success', title: 'Document uploaded' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not upload document', description: error.data?.statusMessage || error.message })
  } finally {
    uploadingDocument.value = false
  }
}

async function recordGrading() {
  if (!gradingForm.beltRankId || !gradingForm.awardedDate) {
    toast.add({ color: 'warning', title: 'Awarded rank and date are required' })
    return
  }
  savingGrading.value = true
  try {
    const formData = new FormData()
    formData.append('beltRankId', String(gradingForm.beltRankId))
    formData.append('awardedDate', gradingForm.awardedDate)
    if (gradingForm.examiner.trim()) formData.append('examiner', gradingForm.examiner.trim())
    if (gradingForm.certificateNumber.trim()) formData.append('certificateNumber', gradingForm.certificateNumber.trim())
    if (gradingForm.notes.trim()) formData.append('notes', gradingForm.notes.trim())
    if (gradingForm.certificate) formData.append('certificate', gradingForm.certificate)
    if (editingGradingId.value) await $fetch(`/api/students/${studentId}/gradings/${editingGradingId.value}`, { method: 'PATCH', body: formData })
    else await $fetch(`/api/students/${studentId}/gradings`, { method: 'POST', body: formData })
    const wasEditing = editingGradingId.value !== null
    cancelGradingEdit()
    await Promise.all([refreshGradings(), refreshStudent()])
    toast.add({ color: 'success', title: wasEditing ? 'Grading updated' : 'Grading recorded' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not record grading', description: error.data?.statusMessage || error.message })
  } finally {
    savingGrading.value = false
  }
}

</script>
