<template>
  <div class="max-w-6xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">User Management</h1>

    <!-- Create User Form (only if user has permissions) -->
    <UCard class="mb-6" v-if="canCreateUsers">
      <h3 class="text-lg font-semibold mb-3">Add User</h3>
      <form @submit.prevent="createUser">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UInput v-model="newUser.name" placeholder="Full Name" required />
          <UInput v-model="newUser.email" type="email" placeholder="Email" required />
          <UInput v-model="newUser.password" type="password" placeholder="Password" required />
          <UInput v-model="newUser.danDegree" placeholder="Dan Degree (e.g., 1st Dan)" />
        </div>
        <div class="mt-4">
          <h4 class="font-medium mb-2">Assignments</h4>
          <div v-for="(assign, index) in newUser.assignments" :key="index" class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
            <USelect
              v-model="assign.role"
              :items="filteredRoleOptions"
              placeholder="Role"
              @update:model-value="assign.scopeId = null"
            />
            <template v-if="isNodeRole(assign.role)">
              <USelect
                v-model="assign.scopeId"
                :items="filteredNodeOptions"
                placeholder="Select Node"
              />
            </template>
            <template v-else-if="isDojoRole(assign.role)">
              <USelect
                v-model="assign.scopeId"
                :items="filteredDojoOptions"
                placeholder="Select Dojo"
              />
            </template>
            <div v-else></div>
            <UButton color="error" variant="ghost" size="sm" @click="removeAssignment(newUser.assignments, +index)">Remove</UButton>
          </div>
          <UButton size="sm" color="secondary" @click="addAssignment(newUser.assignments)">Add Assignment</UButton>
        </div>
        <UButton type="submit" class="mt-4" :loading="creating">Create User</UButton>
      </form>
    </UCard>

    <!-- No permissions message -->
    <UCard class="mb-6" v-else>
      <p class="text-gray-500">You do not have permission to create new users.</p>
    </UCard>

    <!-- User List -->
    <UCard>
      <h2 class="text-lg font-semibold mb-4">Users</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avatar</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dan Degree</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certificate</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignments</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="user in users" :key="user.id">
              <td class="px-4 py-4">
                <img v-if="user.avatar" :src="user.avatar" class="h-10 w-10 rounded-full object-cover" />
                <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">No</div>
              </td>
              <td class="px-4 py-4">{{ user.name }}</td>
              <td class="px-4 py-4">{{ user.email }}</td>
              <td class="px-4 py-4">{{ user.danDegree || '-' }}</td>
              <td class="px-4 py-4">
                <a v-if="user.certificateUrl" :href="user.certificateUrl" target="_blank" class="text-blue-600 hover:underline">View</a>
                <span v-else>-</span>
              </td>
              <td class="px-4 py-4">
                <span v-for="(assign, idx) in user.assignments" :key="idx" class="inline-block bg-gray-100 text-xs px-2 py-1 rounded mr-1 mb-1">
                  {{ assign.role }} ({{ assign.scopeType }}: {{ assign.scopeName || 'Unknown' }})
                </span>
                <span v-if="!user.assignments.length" class="text-gray-400">No assignments</span>
              </td>
              <td class="px-4 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                  <UButton color="primary" variant="ghost" size="sm" @click="startEdit(user)">Edit</UButton>
                  <UButton color="error" variant="ghost" size="sm" @click="deleteUser(user.id)">Delete</UButton>
                  <div class="flex items-center gap-1">
                    <UInput type="file" accept="image/*" :id="`avatar-${user.id}`" class="hidden" @change="(e) => uploadAvatar(user.id, e)" />
                    <UButton size="xs" color="secondary" @click="triggerFileInput(`avatar-${user.id}`)">Upload Avatar</UButton>
                  </div>
                  <div class="flex items-center gap-1">
                    <UInput type="file" accept=".pdf,.jpg,.jpeg,.png" :id="`cert-${user.id}`" class="hidden" @change="(e) => uploadCertificate(user.id, e)" />
                    <UButton size="xs" color="secondary" @click="triggerFileInput(`cert-${user.id}`)">Upload Cert</UButton>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="7" class="px-6 py-4 text-center text-gray-500">No users yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inline Edit Form -->
      <div v-if="editingUser" class="mt-6 border-t pt-4">
        <h3 class="text-lg font-semibold mb-3">Edit User</h3>
        <form @submit.prevent="updateUser">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UInput v-model="editForm.name" placeholder="Full Name" required />
            <UInput v-model="editForm.email" type="email" placeholder="Email" required />
            <UInput v-model="editForm.danDegree" placeholder="Dan Degree" />
          </div>
          <div class="mt-4">
            <h4 class="font-medium mb-2">Assignments</h4>
            <div v-for="(assign, index) in editForm.assignments" :key="index" class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
              <USelect
                v-model="assign.role"
                :items="filteredRoleOptions"
                placeholder="Role"
                @update:model-value="assign.scopeId = null"
              />
              <template v-if="isNodeRole(assign.role)">
                <USelect
                  v-model="assign.scopeId"
                  :items="filteredNodeOptions"
                  placeholder="Select Node"
                />
              </template>
              <template v-else-if="isDojoRole(assign.role)">
                <USelect
                  v-model="assign.scopeId"
                  :items="filteredDojoOptions"
                  placeholder="Select Dojo"
                />
              </template>
              <div v-else></div>
              <UButton color="error" variant="ghost" size="sm" @click="removeAssignment(editForm.assignments, +index)">Remove</UButton>
            </div>
            <UButton size="sm" color="secondary" @click="addAssignment(editForm.assignments)">Add Assignment</UButton>
          </div>
          <div class="flex gap-2 mt-4">
            <UButton type="submit" :loading="updating">Update</UButton>
            <UButton type="button" color="neutral" @click="cancelEdit">Cancel</UButton>
          </div>
        </form>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const users = ref<any[]>([])
const nodes = ref<any[]>([])
const flatNodes = ref<any[]>([])
const dojos = ref<any[]>([])
const levels = ref<any[]>([])
const permissions = ref({
  allowedRoles: [] as string[],
  allowedNodeIds: [] as number[],
  allowedDojoIds: [] as number[],
})

const creating = ref(false)
const updating = ref(false)

// File upload states
const uploadingAvatar = ref(false)
const uploadingCertificate = ref(false)

const roleOptions = [
  { label: 'Owner', value: 'owner' },
  { label: 'Admin', value: 'admin' },
  { label: 'State Head', value: 'state_head' },
  { label: 'District Head', value: 'district_head' },
  { label: 'City Head', value: 'city_head' },
  { label: 'Dojo Head', value: 'dojo_head' },
  { label: 'Instructor', value: 'instructor' },
  { label: 'Member', value: 'member' },
]

// Filtered role options based on permissions
const filteredRoleOptions = computed(() => {
  if (permissions.value.allowedRoles.length === 0) return []
  return roleOptions.filter(r => permissions.value.allowedRoles.includes(r.value))
})

// ✅ Fixed: convert node.id to number using Number()
const filteredNodeOptions = computed(() => {
  return flatNodes.value
    .filter(node => permissions.value.allowedNodeIds.includes(Number(node.id)))
    .map(node => ({
      label: nodePathMap.value[node.id] || node.name,
      value: Number(node.id),
    }))
})

// ✅ Fixed: convert dojo.id to number using Number()
const filteredDojoOptions = computed(() => {
  return dojos.value
    .filter(dojo => permissions.value.allowedDojoIds.includes(Number(dojo.id)))
    .map(dojo => ({
      label: dojo.name,
      value: Number(dojo.id),
    }))
})

// Whether the current user can create users
const canCreateUsers = computed(() => {
  return permissions.value.allowedRoles.length > 0 ||
         permissions.value.allowedNodeIds.length > 0 ||
         permissions.value.allowedDojoIds.length > 0
})

const roleScopeMap: Record<string, string> = {
  state_head: 'node',
  district_head: 'node',
  city_head: 'node',
  dojo_head: 'dojo',
  instructor: 'dojo',
}

function isNodeRole(role: string): boolean {
  return roleScopeMap[role] === 'node'
}

function isDojoRole(role: string): boolean {
  return roleScopeMap[role] === 'dojo'
}

const levelNameMap = computed(() => {
  const map: Record<string, number> = {}
  for (const level of levels.value) {
    map[level.name] = level.id
  }
  return map
})

function flattenTree(tree: any[]): any[] {
  let result: any[] = []
  for (const node of tree) {
    result.push({ ...node })
    if (node.children && node.children.length) {
      result = result.concat(flattenTree(node.children))
    }
  }
  return result
}

function buildNodePathMap(nodesList: any[]) {
  const map: Record<number, any> = {}
  for (const node of nodesList) {
    map[node.id] = node
  }
  const pathMap: Record<number, string> = {}
  for (const node of nodesList) {
    const parts: string[] = []
    let current: any = node
    while (current) {
      parts.unshift(current.name)
      if (current.parentId && map[current.parentId]) {
        current = map[current.parentId]
      } else {
        break
      }
    }
    pathMap[node.id] = parts.join(' → ')
  }
  return pathMap
}

const nodePathMap = ref<Record<number, string>>({})

// ----- New User Form -----
const newUser = reactive<any>({
  name: '',
  email: '',
  password: '',
  danDegree: '',
  assignments: [],
})

// ----- Edit Form -----
const editingUser = ref<any>(null)
const editForm = reactive<any>({
  name: '',
  email: '',
  danDegree: '',
  assignments: [],
})

// ----- Load Permissions and Data -----
async function loadPermissions() {
  try {
    permissions.value = await $fetch('/api/users/me/permissions')
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load permissions',
      description: error.data?.statusMessage || error.message,
    })
  }
}

async function loadData() {
  try {
    const [usersData, nodesData, dojosData, levelsData] = await Promise.all([
      $fetch('/api/users'),
      $fetch('/api/hierarchy/nodes'),
      $fetch('/api/dojos'),
      $fetch('/api/hierarchy/levels'),
    ])
    users.value = usersData
    nodes.value = nodesData
    const flattened = flattenTree(nodesData)
    flatNodes.value = flattened
    nodePathMap.value = buildNodePathMap(flattened)
    dojos.value = dojosData
    levels.value = levelsData
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load data',
      description: error.data?.statusMessage || error.message,
    })
  }
}

// ----- Assignment Helpers -----
function addAssignment(assignments: any[]) {
  assignments.push({
    role: 'member',
    scopeId: null,
  })
}

function removeAssignment(assignments: any[], index: number) {
  assignments.splice(index, 1)
}

// ----- Create User -----
async function createUser() {
  if (!newUser.name || !newUser.email || !newUser.password) {
    toast.add({ color: 'warning', title: 'Name, email, and password are required' })
    return
  }

  // ✅ Ensure scopeId is a number
  const assignments = newUser.assignments
    .filter((a: any) => a.role && a.scopeId)
    .map((a: any) => ({
      role: a.role,
      scopeType: isNodeRole(a.role) ? 'node' : (isDojoRole(a.role) ? 'dojo' : null),
      scopeId: Number(a.scopeId),
    }))
    .filter((a: any) => a.scopeType !== null)

  for (const a of assignments) {
    if (isNodeRole(a.role) || isDojoRole(a.role)) {
      if (!a.scopeId) {
        toast.add({ color: 'warning', title: `Please select a scope for role: ${a.role}` })
        return
      }
    }
  }

  creating.value = true
  try {
    await $fetch('/api/users', {
      method: 'POST' as any,
      body: {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        danDegree: newUser.danDegree || null,
        assignments,
      },
    })
    toast.add({ color: 'success', title: 'User created' })
    newUser.name = ''
    newUser.email = ''
    newUser.password = ''
    newUser.danDegree = ''
    newUser.assignments = []
    await loadData()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Creation failed',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    creating.value = false
  }
}

// ----- Start Edit -----
function startEdit(user: any) {
  editingUser.value = user
  editForm.name = user.name
  editForm.email = user.email
  editForm.danDegree = user.danDegree || ''
  editForm.assignments = user.assignments.map((a: any) => ({
    role: a.role,
    scopeId: a.scopeId, // will be converted later
  }))
}

function cancelEdit() {
  editingUser.value = null
  editForm.name = ''
  editForm.email = ''
  editForm.danDegree = ''
  editForm.assignments = []
}

// ----- Update User -----
async function updateUser() {
  if (!editingUser.value) return
  if (!editForm.name || !editForm.email) {
    toast.add({ color: 'warning', title: 'Name and email are required' })
    return
  }

  // ✅ Ensure scopeId is a number
  const assignments = editForm.assignments
    .filter((a: any) => a.role && a.scopeId)
    .map((a: any) => ({
      role: a.role,
      scopeType: isNodeRole(a.role) ? 'node' : (isDojoRole(a.role) ? 'dojo' : null),
      scopeId: Number(a.scopeId),
    }))
    .filter((a: any) => a.scopeType !== null)

  for (const a of assignments) {
    if (isNodeRole(a.role) || isDojoRole(a.role)) {
      if (!a.scopeId) {
        toast.add({ color: 'warning', title: `Please select a scope for role: ${a.role}` })
        return
      }
    }
  }

  updating.value = true
  try {
    // ✅ convert user id to number
    const userId = Number(editingUser.value.id)
    await $fetch(`/api/users/${userId}`, {
      method: 'PATCH' as any,
      body: {
        name: editForm.name,
        email: editForm.email,
        danDegree: editForm.danDegree || null,
        assignments,
      },
    })
    toast.add({ color: 'success', title: 'User updated' })
    cancelEdit()
    await loadData()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Update failed',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    updating.value = false
  }
}

// ----- Delete User -----
async function deleteUser(id: number) {
  if (!confirm('Delete this user? This cannot be undone.')) return
  try {
    await $fetch(`/api/users/${Number(id)}`, { method: 'DELETE' as any })
    toast.add({ color: 'success', title: 'User deleted' })
    await loadData()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Deletion failed',
      description: error.data?.statusMessage || error.message,
    })
  }
}

// ----- File Upload Helpers -----
function triggerFileInput(inputId: string) {
  const input = document.getElementById(inputId) as HTMLInputElement
  if (input) input.click()
}

async function uploadAvatar(userId: number, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingAvatar.value = true
  try {
    const fd = new FormData()
    fd.append('avatar', file)
    await $fetch(`/api/users/${Number(userId)}/avatar`, { method: 'POST' as any, body: fd })
    toast.add({ color: 'success', title: 'Avatar uploaded' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Upload failed', description: error.data?.statusMessage })
  } finally {
    uploadingAvatar.value = false
    target.value = ''
  }
}

async function uploadCertificate(userId: number, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingCertificate.value = true
  try {
    const fd = new FormData()
    fd.append('certificate', file)
    await $fetch(`/api/users/${Number(userId)}/certificate`, { method: 'POST' as any, body: fd })
    toast.add({ color: 'success', title: 'Certificate uploaded' })
    await loadData()
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Upload failed', description: error.data?.statusMessage })
  } finally {
    uploadingCertificate.value = false
    target.value = ''
  }
}

// ----- Mounted -----
onMounted(async () => {
  await Promise.all([loadPermissions(), loadData()])
})
</script>