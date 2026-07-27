<template>
  <div class="mx-auto max-w-7xl">
    <section class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm font-semibold text-primary">PEOPLE</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Import students</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Move existing student records from Excel or Google Sheets. Nothing is saved until you review the preview and confirm the import.</p>
      </div>
      <UButton to="/students" color="neutral" variant="ghost" icon="i-lucide-arrow-left">Student directory</UButton>
    </section>

    <UAlert class="mb-6" color="primary" variant="subtle" icon="i-lucide-shield-check" title="Safe, validated import" description="OpenDojos matches dojo, program, belt, and tuition-plan names against your workspace. Unknown values, duplicates, and plan-limit problems are rejected before import." />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="space-y-6">
        <UCard>
          <template #header><div><h2 class="font-semibold">1. Prepare and upload the spreadsheet</h2><p class="mt-1 text-sm text-slate-500">Download the template, edit it in your spreadsheet application, then export or save it as CSV.</p></div></template>
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <UButton href="/api/student-imports/template" external color="neutral" variant="outline" icon="i-lucide-download">Download CSV template</UButton>
            <label class="flex min-h-11 flex-1 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 px-4 text-sm hover:border-primary dark:border-slate-700">
              <input type="file" accept=".csv,text/csv" class="hidden" @change="selectFile">
              <UIcon name="i-lucide-file-spreadsheet" class="mr-2 h-5 w-5 text-primary" />
              <span class="truncate">{{ selectedFile?.name || 'Choose a CSV file' }}</span>
            </label>
            <UButton :disabled="!selectedFile" :loading="previewing" icon="i-lucide-scan-search" @click="previewFile">Preview import</UButton>
          </div>
          <p class="mt-3 text-xs text-slate-500">Maximum 500 student rows and 2 MB per import. Dates may use YYYY-MM-DD or DD/MM/YYYY.</p>
        </UCard>

        <UCard v-if="preview">
          <template #header>
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 class="font-semibold">2. Review the preview</h2><p class="mt-1 text-sm text-slate-500">{{ preview.fileName }} · {{ preview.total }} rows</p></div>
              <div class="flex gap-2"><UBadge color="success" variant="subtle">{{ preview.valid }} ready</UBadge><UBadge :color="preview.invalid ? 'error' : 'neutral'" variant="subtle">{{ preview.invalid }} need attention</UBadge></div>
            </div>
          </template>

          <div class="max-h-[600px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table class="min-w-[1100px] text-sm">
              <thead class="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-950">
                <tr><th class="px-3 py-3">Row</th><th class="px-3 py-3">Student</th><th class="px-3 py-3">Dojo</th><th class="px-3 py-3">Program</th><th class="px-3 py-3">Belt</th><th class="px-3 py-3">Fee plan</th><th class="px-3 py-3">Result</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in preview.rows" :key="row.rowNumber" class="border-t border-slate-100 align-top dark:border-slate-800">
                  <td class="px-3 py-3 text-slate-500">{{ row.rowNumber }}</td>
                  <td class="px-3 py-3"><p class="font-medium">{{ row.input.firstName }} {{ row.input.lastName }}</p><p class="mt-1 text-xs text-slate-400">{{ row.input.email || row.input.phone || 'No contact details' }}</p></td>
                  <td class="px-3 py-3">{{ row.resolved.dojo || '—' }}</td>
                  <td class="px-3 py-3">{{ row.resolved.program || '—' }}</td>
                  <td class="px-3 py-3">{{ row.resolved.belt || '—' }}</td>
                  <td class="px-3 py-3">{{ row.resolved.feePlan || '—' }}</td>
                  <td class="max-w-sm px-3 py-3">
                    <UBadge :color="row.valid ? 'success' : 'error'" variant="subtle">{{ row.valid ? 'Ready' : 'Cannot import' }}</UBadge>
                    <ul v-if="row.errors.length" class="mt-2 list-disc space-y-1 pl-4 text-xs text-red-600"><li v-for="error in row.errors" :key="error">{{ error }}</li></ul>
                    <ul v-if="row.warnings.length" class="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-600"><li v-for="warning in row.warnings" :key="warning">{{ warning }}</li></ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p class="text-sm text-slate-500">Invalid rows will be skipped. Correct them in the spreadsheet and upload again if they should be included.</p>
            <UButton :disabled="preview.valid === 0" :loading="importing" icon="i-lucide-file-input" @click="commitImport">Import {{ preview.valid }} valid student{{ preview.valid === 1 ? '' : 's' }}</UButton>
          </div>
        </UCard>

        <UCard v-if="result">
          <template #header><div><h2 class="font-semibold">3. Import result</h2><p class="mt-1 text-sm text-slate-500">{{ result.imported }} imported · {{ result.failed }} skipped or failed</p></div></template>
          <UAlert :color="result.failed ? 'warning' : 'success'" :title="result.failed ? 'Import completed with skipped rows' : 'Import completed successfully'" :description="result.failed ? 'Download the result report to see what needs correction.' : 'The imported students are now available in the directory.'" />
          <div class="mt-5 flex flex-wrap gap-3">
            <UButton to="/students" icon="i-lucide-users">Open student directory</UButton>
            <UButton color="neutral" variant="outline" icon="i-lucide-download" @click="downloadResults">Download result CSV</UButton>
            <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" @click="resetImport">Import another file</UButton>
          </div>
        </UCard>
      </div>

      <aside class="space-y-4">
        <UCard>
          <template #header><h2 class="font-semibold">Required columns</h2></template>
          <ul class="space-y-2 text-sm text-slate-600 dark:text-slate-300"><li>First Name</li><li>Last Name</li><li>Dojo</li></ul>
          <p class="mt-4 text-xs leading-5 text-slate-500">If the workspace has only one dojo, a blank Dojo cell will use that location. A “Student Name” column is also accepted and split into first and last name.</p>
        </UCard>
        <UCard>
          <template #header><h2 class="font-semibold">Before importing</h2></template>
          <ul class="list-disc space-y-2 pl-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            <li>Create the dojos, programs, belts, and tuition plans referenced by the file.</li>
            <li>Use the same names shown in OpenDojos.</li>
            <li>Duplicates are checked by email, phone, or name plus date of birth.</li>
            <li>Historical payments and attendance are not created by this import.</li>
          </ul>
        </UCard>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Import students | OpenDojos' })

type ImportInput = Record<string, string>
type PreviewRow = {
  rowNumber: number
  input: ImportInput
  resolved: { dojo: string, program: string, belt: string, feePlan: string }
  errors: string[]
  warnings: string[]
  valid: boolean
}
type Preview = { fileName: string, total: number, valid: number, invalid: number, rows: PreviewRow[] }
type ImportResult = { total: number, imported: number, failed: number, results: Array<{ rowNumber: number, student: string, result: string, reason: string, studentId?: number }> }

const toast = useToast()
const selectedFile = ref<File | null>(null)
const previewing = ref(false)
const importing = ref(false)
const preview = ref<Preview | null>(null)
const result = ref<ImportResult | null>(null)

function selectFile(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] || null
  preview.value = null
  result.value = null
}

async function previewFile() {
  if (!selectedFile.value) return
  previewing.value = true
  try {
    const body = new FormData()
    body.append('file', selectedFile.value)
    preview.value = await $fetch<Preview>('/api/student-imports/preview', { method: 'POST', body })
    result.value = null
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not preview the import', description: error.data?.statusMessage || error.message })
  } finally {
    previewing.value = false
  }
}

async function commitImport() {
  if (!preview.value?.valid) return
  importing.value = true
  try {
    result.value = await $fetch<ImportResult>('/api/student-imports/commit', {
      method: 'POST',
      body: { fileName: preview.value.fileName, rows: preview.value.rows.map(row => row.input) },
    })
    toast.add({ color: result.value.failed ? 'warning' : 'success', title: `${result.value.imported} students imported`, description: result.value.failed ? `${result.value.failed} rows were skipped or failed.` : undefined })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not complete the import', description: error.data?.statusMessage || error.message })
  } finally {
    importing.value = false
  }
}

function csvCell(value: unknown) {
  const original = String(value ?? '')
  const text = /^[=+\-@]/.test(original) ? `'${original}` : original
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function downloadResults() {
  if (!result.value) return
  const rows = [
    ['Row', 'Student', 'Result', 'Reason', 'Student ID'],
    ...result.value.results.map(item => [item.rowNumber, item.student, item.result, item.reason, item.studentId || '']),
  ]
  const content = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'opendojos-student-import-results.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function resetImport() {
  selectedFile.value = null
  preview.value = null
  result.value = null
}
</script>
