<template>
  <div class="ml-3 border-l border-slate-200 pl-3 dark:border-slate-700">
    <div class="flex flex-wrap items-center gap-2 py-2">
      <UButton
        v-if="hasChildren"
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="expanded ? `Collapse ${node.name}` : `Expand ${node.name}`"
        @click="expanded = !expanded"
      />
      <span v-else class="flex h-6 w-6 items-center justify-center text-slate-400"><UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5" /></span>

      <span class="font-medium">{{ node.name }}</span>
      <UBadge color="neutral" variant="subtle" size="sm">{{ levelName }}</UBadge>

      <UButton
        v-if="canManageChildren(node.id) && canAddChildren(node)"
        size="xs"
        color="primary"
        variant="soft"
        icon="i-lucide-plus"
        @click="$emit('addChild', node)"
      >
        Add {{ nextChildLevelName(node) }}
      </UButton>
      <UButton v-if="canModify(node.id)" size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="$emit('edit', node)">Edit</UButton>
      <UButton v-if="canModify(node.id) && !hasChildren" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="$emit('delete', node.id)">Remove</UButton>
    </div>

    <div v-if="expanded && hasChildren" class="ml-3">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :levels="levels"
        :can-manage-children="canManageChildren"
        :can-add-children="canAddChildren"
        :next-child-level-name="nextChildLevelName"
        :can-modify="canModify"
        @add-child="$emit('addChild', $event)"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  node: { id: number, name: string, levelId: number, children: any[] }
  levels: any[]
  canManageChildren: (nodeId: number) => boolean
  canAddChildren: (node: { id: number, levelId: number }) => boolean
  nextChildLevelName: (node: { id: number, levelId: number }) => string
  canModify: (nodeId: number) => boolean
}>()

const expanded = ref(true)
const hasChildren = computed(() => props.node.children?.length > 0)
const levelName = computed(() => props.levels.find(level => level.id === props.node.levelId)?.name || 'Location')
</script>
