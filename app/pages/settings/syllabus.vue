<template>
  <div class="mx-auto max-w-5xl">
    <section class="mb-6">
      <p class="text-sm font-semibold text-primary">CURRICULUM</p>
      <h2 class="mt-1 text-2xl font-semibold">Syllabus</h2>
      <p class="mt-2 text-sm text-slate-500">Choose a belt, add what students must know, then publish it.</p>
    </section>

    <UAlert v-if="contextError" class="mb-5" color="error" title="Syllabus access unavailable" :description="apiErrorMessage(contextError)" />
    <template v-else>
      <UCard class="mb-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField v-if="scopeOptions.length > 1" label="Applies to"><USelect v-model="selectedScopeKey" :items="scopeOptions" /></UFormField>
          <UFormField label="Students grading for"><USelect v-model="selectedRankId" :items="rankOptions" placeholder="Choose a belt" /></UFormField>
        </div>
      </UCard>

      <div v-if="loading" class="space-y-4"><USkeleton class="h-24" /><USkeleton class="h-44" /></div>
      <UCard v-else-if="selectedRankId">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div><h3 class="font-semibold">{{ selectedRank?.name }} requirements</h3><p class="mt-1 text-sm text-slate-500">Changes remain a draft until you publish them.</p></div>
            <UBadge :color="loaded?.version?.status === 'published' ? 'success' : loaded?.version ? 'warning' : 'neutral'" variant="subtle">{{ loaded?.version?.status || 'Not created' }}</UBadge>
          </div>
        </template>

        <div class="space-y-5">
          <UFormField label="Syllabus title"><UInput v-model="form.title" :placeholder="`${selectedRank?.name || 'Belt'} syllabus`" /></UFormField>
          <label class="flex items-start gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><UCheckbox v-model="form.inheritPrevious" /><span><span class="block text-sm font-medium">Include the previous belt syllabus</span><span class="mt-1 block text-xs text-slate-500">Recommended for cumulative grading requirements.</span></span></label>

          <div v-for="(section, sectionIndex) in form.sections" :key="section.key" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <UInput v-model="section.name" class="flex-1" placeholder="Section name, e.g. Kata" />
              <UButton color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Remove section" @click="removeSection(Number(sectionIndex))" />
            </div>
            <div class="mt-4 space-y-2">
              <div v-for="(item, itemIndex) in section.items" :key="item.key" class="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] dark:bg-slate-800/60">
                <div><UInput v-model="item.name" class="w-full" placeholder="Requirement, e.g. Taikyoku Jodan" /><UInput v-model="item.description" class="mt-2 w-full" placeholder="Guidance (optional)" /></div>
                <label class="flex items-center gap-2 self-start pt-2 text-sm"><UCheckbox v-model="item.required" /> Required</label>
                <UButton class="self-start" color="error" variant="ghost" icon="i-lucide-x" aria-label="Remove item" @click="section.items.splice(Number(itemIndex), 1)" />
              </div>
              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-plus" @click="addItem(section)">Add item</UButton>
            </div>
          </div>
          <UButton color="neutral" variant="soft" icon="i-lucide-folder-plus" @click="addSection">Add section</UButton>
        </div>

        <template #footer>
          <div class="flex flex-wrap justify-between gap-3">
            <UButton v-if="loaded?.syllabus" color="error" variant="ghost" :loading="deleting" @click="deleteSyllabus">Archive syllabus</UButton><span v-else />
            <div class="flex gap-2"><UButton color="neutral" variant="soft" :loading="saving" @click="saveDraftFromButton">Save draft</UButton><UButton icon="i-lucide-send" :loading="publishing" @click="publish">Publish</UButton></div>
          </div>
        </template>
      </UCard>
      <UCard v-else><EmptyState icon="i-lucide-book-open-check" message="Choose a belt to start building its syllabus." /></UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const toast = useToast()
const { data: context, error: contextError } = await useFetch<any>('/api/syllabi/context')
const selectedRankId = ref<number | undefined>()
const selectedScopeKey = ref('organization:')
const loaded = ref<any>(null)
const loading = ref(false); const saving = ref(false); const publishing = ref(false); const deleting = ref(false)
const form = reactive<any>({ title: '', inheritPrevious: true, sections: [] })
const scopeOptions = computed(() => (context.value?.scopes || []).map((scope: any) => ({ label: scope.label, value: `${scope.scopeType}:${scope.scopeId || ''}` })))
const rankOptions = computed(() => (context.value?.ranks || []).map((rank: any) => ({ label: `${rank.name} · ${rank.system?.name || 'Belt system'}`, value: rank.id })))
const selectedRank = computed(() => (context.value?.ranks || []).find((rank: any) => rank.id === selectedRankId.value))
const selectedScope = computed(() => { const [scopeType, id] = selectedScopeKey.value.split(':'); return { scopeType, scopeId: id ? Number(id) : null } })
let key = 0
function newItem(item: any = {}) { return { key: ++key, name: item.name || '', description: item.description || '', required: item.required !== false } }
function newSection(section: any = {}) { return { key: ++key, name: section.name || '', items: (section.items || []).map(newItem) } }
function addSection() { form.sections.push(newSection()) }
function addItem(section: any) { section.items.push(newItem()) }
function removeSection(index: number) { form.sections.splice(index, 1) }
async function loadSyllabus() {
  if (!selectedRankId.value) return
  loading.value = true
  try {
    loaded.value = await $fetch(`/api/syllabi/${selectedRankId.value}`, { query: selectedScope.value })
    Object.assign(form, { title: loaded.value.syllabus?.title || `${selectedRank.value?.name || 'Belt'} syllabus`, inheritPrevious: loaded.value.version?.inheritPrevious ?? true, sections: (loaded.value.sections || []).map(newSection) })
    if (!form.sections.length) addSection()
  } catch (error: any) { toast.add({ color: 'error', title: 'Could not load syllabus', description: apiErrorMessage(error) }) } finally { loading.value = false }
}
watch([selectedRankId, selectedScopeKey], loadSyllabus)
watchEffect(() => { if (scopeOptions.value.length && !scopeOptions.value.some((item: any) => item.value === selectedScopeKey.value)) selectedScopeKey.value = scopeOptions.value[0].value })
async function saveDraft(showToast = true) {
  if (!selectedRankId.value) return false
  const sections = form.sections.map((section: any) => ({ name: section.name.trim(), items: section.items.filter((item: any) => item.name.trim()).map((item: any) => ({ name: item.name.trim(), description: item.description.trim() || null, required: item.required })) })).filter((section: any) => section.name && section.items.length)
  if (!sections.length) { toast.add({ color: 'warning', title: 'Add at least one section and item' }); return false }
  saving.value = true
  try { await $fetch(`/api/syllabi/${selectedRankId.value}`, { method: 'PUT', body: { ...selectedScope.value, title: form.title.trim() || `${selectedRank.value?.name} syllabus`, inheritPrevious: form.inheritPrevious, sections } }); await loadSyllabus(); if (showToast) toast.add({ color: 'success', title: 'Draft saved' }); return true } catch (error: any) { toast.add({ color: 'error', title: 'Could not save syllabus', description: apiErrorMessage(error) }); return false } finally { saving.value = false }
}
async function saveDraftFromButton() { await saveDraft() }
async function publish() { publishing.value = true; try { if (!await saveDraft(false)) return; await $fetch(`/api/syllabi/${selectedRankId.value}/publish`, { method: 'POST', body: selectedScope.value }); await loadSyllabus(); toast.add({ color: 'success', title: 'Syllabus published', description: 'It is now available for student assessment.' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not publish syllabus', description: apiErrorMessage(error) }) } finally { publishing.value = false } }
async function deleteSyllabus() { if (!confirm('Archive this syllabus? Students already using a published version will keep their progress.')) return; deleting.value = true; try { await $fetch(`/api/syllabi/${selectedRankId.value}`, { method: 'DELETE', body: selectedScope.value }); await loadSyllabus(); toast.add({ color: 'success', title: 'Syllabus archived' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not archive syllabus', description: apiErrorMessage(error) }) } finally { deleting.value = false } }
</script>
