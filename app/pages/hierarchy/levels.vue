<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
await navigateTo('/settings/hierarchy/levels', { redirectCode: 301, replace: true })
</script>
