<template>
  <div class="ml-4 border-l-2 border-gray-200 pl-2">
    <div class="flex items-center gap-2 py-1">
      <!-- Toggle button -->
      <button
        @click="expanded = !expanded"
        class="px-1 py-0.5 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 focus:outline-none w-6 text-center font-mono"
      >
        {{ hasChildren ? (expanded ? '▼' : '▶') : '•' }}
      </button>

      <span class="font-medium">{{ node.name }}</span>
      <span class="text-xs text-gray-400">(Level: {{ levelName }})</span>

      <button
        v-if="canManageChildren(node.id) && canAddChildren(node)"
        class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        @click="$emit('addChild', node)"
      >
        Add Child
      </button>
      <button
        v-if="canModify(node.id)"
        class="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
        @click="$emit('edit', node)"
      >
        Edit
      </button>
      <button
        v-if="canModify(node.id)"
        class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
        @click="$emit('delete', node.id)"
      >
        Delete
      </button>
    </div>

    <!-- Children -->
    <div v-if="expanded && hasChildren" class="ml-4">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :levels="levels"
        :can-manage-children="canManageChildren"
        :can-add-children="canAddChildren"
        :can-modify="canModify"
        @addChild="$emit('addChild', $event)"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  node: {
    id: number
    name: string
    levelId: number
    children: any[]
  }
  levels: any[]
  canManageChildren: (nodeId: number) => boolean
  canAddChildren: (node: { id: number, levelId: number }) => boolean
  canModify: (nodeId: number) => boolean
}>()

const expanded = ref(true)

const hasChildren = computed(() => props.node.children?.length > 0)

const levelName = computed(() => {
  const level = props.levels.find(l => l.id === props.node.levelId)
  return level?.name || 'Unknown'
})
</script>
