<template>
  <section class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><p class="font-medium">Additional fees</p><p class="mt-1 text-sm text-slate-500">Add grading exam or miscellaneous charges to this receipt only.</p></div>
      <UButton type="button" color="neutral" variant="soft" size="sm" icon="i-lucide-plus" @click="addItem">Add fee</UButton>
    </div>
    <div v-if="modelValue.length" class="mt-4 space-y-3">
      <div v-for="(item, index) in modelValue" :key="item.id" class="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[180px_minmax(0,1fr)_150px_auto] dark:bg-slate-800/60">
        <UFormField label="Fee type"><USelect v-model="item.type" :items="feeTypes" /></UFormField>
        <UFormField label="Description" required><UInput v-model="item.label" :placeholder="item.type === 'grading_exam' ? 'e.g. Yellow belt grading' : 'What is this charge for?'" required /></UFormField>
        <UFormField label="Amount" required><UInput v-model.number="item.amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></UFormField>
        <UButton type="button" class="self-end" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Remove additional fee" @click="removeItem(index)" />
      </div>
    </div>
    <p v-else class="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60">No additional charges on this payment.</p>
  </section>
</template>

<script setup lang="ts">
import type { AdditionalFeeType } from '../../shared/types/finance'

export interface EditableFeeItem {
  id: number
  type: AdditionalFeeType
  label: string
  amount?: number
}

const props = defineProps<{ modelValue: EditableFeeItem[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditableFeeItem[]] }>()
let nextId = Math.max(0, ...props.modelValue.map(item => item.id)) + 1
const feeTypes = [
  { label: 'Grading exam fee', value: 'grading_exam' },
  { label: 'Miscellaneous fee', value: 'miscellaneous' },
]

function addItem() {
  emit('update:modelValue', [...props.modelValue, { id: nextId++, type: 'grading_exam', label: '', amount: undefined }])
}
function removeItem(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, itemIndex) => itemIndex !== index))
}
</script>
