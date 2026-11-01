<template>
  <div class="flex flex-wrap gap-2">
    <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-file-spreadsheet" :loading="downloading === 'colour'" :disabled="!!downloading" @click="download('colour')">Colour belts .xlsx</UButton>
    <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-file-spreadsheet" :loading="downloading === 'brown_black'" :disabled="!!downloading" @click="download('brown_black')">Brown / Black belts .xlsx</UButton>
    <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-download" :loading="downloading === 'both'" :disabled="!!downloading" @click="download('both')">Both sheets</UButton>
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{ tournamentId: number }>()
const downloading = ref('')
const toast = useToast()
async function download(division: string) {
  downloading.value = division
  try {
    const response = await $fetch.raw<Blob>(`/api/tournaments/${props.tournamentId}/participants.xlsx`, { query: division === 'both' ? {} : { division }, responseType: 'blob' })
    if (!response._data) throw new Error('The workbook could not be downloaded')
    const url = URL.createObjectURL(response._data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'Tournament-participants.xlsx'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error: any) { toast.add({ color: 'error', title: 'Could not download participation list', description: error.message }) }
  finally { downloading.value = '' }
}
</script>
