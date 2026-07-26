<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
await navigateTo('/settings/hierarchy/nodes', { redirectCode: 301, replace: true })
</script>
