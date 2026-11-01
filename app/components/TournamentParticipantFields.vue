<template>
  <div class="grid gap-5 sm:grid-cols-2">
    <UFormField label="Name" required class="sm:col-span-2" help="Enter the full name exactly as it should appear on the organizer's list.">
      <UInput v-model="model.fullName" autocomplete="name" maxlength="150" required class="w-full" />
    </UFormField>
    <UFormField label="DOB" required><UInput v-model="model.dateOfBirth" type="date" :max="maxBirthDate" required class="w-full" /></UFormField>
    <UFormField :label="`Age (as of ${cutoffLabel})`"><UInput :model-value="ageLabel" readonly placeholder="Calculated from DOB" class="w-full" /></UFormField>
    <UFormField label="Weight (kg)" required><UInput v-model.number="model.weightKg" type="number" min="0.01" max="300" step="0.01" inputmode="decimal" required placeholder="e.g. 33.5" class="w-full" /></UFormField>
    <UFormField label="M/F" required><USelect v-model="model.gender" :items="[{ label: 'Male (M)', value: 'M' }, { label: 'Female (F)', value: 'F' }]" placeholder="Select" required class="w-full" /></UFormField>
    <UFormField label="Belt" required><USelect v-model="model.belt" :items="beltItems" placeholder="Select your current belt" required class="w-full" /><p v-if="model.belt" class="mt-2 text-xs text-slate-500">{{ divisionLabel }} participant list</p></UFormField>
    <UFormField label="Category" required help="Use the competition category provided by your coach."><UInput v-model="model.ageCategory" :list="categoryListId" placeholder="e.g. Subjunior" maxlength="100" required class="w-full" /><datalist :id="categoryListId"><option v-for="category in participationCategories" :key="category" :value="category" /></datalist></UFormField>
    <fieldset class="rounded-xl border border-slate-200 p-4 sm:col-span-2 dark:border-slate-800">
      <legend class="px-1 text-sm font-medium">Events <span class="text-red-500">*</span></legend>
      <div class="flex flex-wrap gap-8"><UCheckbox v-model="model.kata" label="Kata" /><UCheckbox v-model="model.kumite" label="Kumite" /></div>
      <p class="mt-3 text-xs text-slate-500">Select Kata, Kumite, or both. Each selected event appears separately in tournament results.</p>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { beltDivision, participationBelts, participationCategories, tournamentAge } from '#shared/utils/tournament-participation'

const props = defineProps<{ cutoffDate: string }>()
const model = defineModel<{ fullName: string, dateOfBirth: string, weightKg: number | undefined, gender: string, belt: string, ageCategory: string, kata: boolean, kumite: boolean }>({ required: true })
const categoryListId = useId()
const beltItems = participationBelts.map(belt => ({ label: belt, value: String(belt) }))
const cutoffLabel = computed(() => new Date(props.cutoffDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))
const maxBirthDate = computed(() => [props.cutoffDate.slice(0, 10), new Date().toISOString().slice(0, 10)].sort()[0])
const ageLabel = computed(() => {
  if (!model.value.dateOfBirth) return ''
  const age = tournamentAge(model.value.dateOfBirth, props.cutoffDate)
  return Number.isFinite(age) && age >= 0 ? `${age} years` : 'Check date of birth'
})
const divisionLabel = computed(() => beltDivision(model.value.belt) === 'brown_black' ? 'Brown / Black belts' : 'Colour belts')
</script>
