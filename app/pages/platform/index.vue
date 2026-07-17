<template>
  <div class="mx-auto max-w-7xl">
    <section class="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-100 via-white to-indigo-50 p-6 dark:border-violet-900/70 dark:from-violet-950/40 dark:via-slate-900 dark:to-indigo-950/30 sm:p-8">
      <p class="text-sm font-semibold text-primary">PLATFORM CONSOLE</p>
      <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">Your OpenDojo business, at a glance</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Monitor customer workspaces and manage access plans without entering an organization’s account.</p>
        </div>
        <UButton icon="i-lucide-refresh-cw" variant="outline" :loading="loading" @click="refreshAll">Refresh</UButton>
      </div>
    </section>

    <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="card in cards" :key="card.label" class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between"><p class="text-sm text-slate-500 dark:text-slate-400">{{ card.label }}</p><UIcon :name="card.icon" class="h-5 w-5 text-primary" /></div>
        <p class="mt-3 text-3xl font-semibold tracking-tight">{{ card.value }}</p>
      </article>
    </section>

    <section class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/70 dark:bg-emerald-950/20">
      <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 class="font-semibold">Subscription revenue outlook</h2><p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Projected from public monthly plan prices. It is not a record of collected payments.</p></div><p class="text-xs text-slate-500">Excludes GST and custom Enterprise pricing</p></div>
      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <div class="rounded-xl bg-white/80 p-4 dark:bg-slate-900/80"><p class="text-sm text-slate-500">Projected MRR</p><p class="mt-1 text-2xl font-semibold">{{ formatInr(overview?.revenue.estimatedMrr || 0) }}</p></div>
        <div class="rounded-xl bg-white/80 p-4 dark:bg-slate-900/80"><p class="text-sm text-slate-500">Projected ARR</p><p class="mt-1 text-2xl font-semibold">{{ formatInr(overview?.revenue.estimatedArr || 0) }}</p></div>
        <div class="rounded-xl bg-white/80 p-4 dark:bg-slate-900/80"><p class="text-sm text-slate-500">Paid workspaces</p><p class="mt-1 text-2xl font-semibold">{{ overview?.revenue.payingWorkspaces || 0 }} <span class="text-sm font-normal text-slate-500">+ {{ overview?.revenue.customEnterpriseWorkspaces || 0 }} custom Enterprise</span></p></div>
      </div>
    </section>

    <section class="mt-8 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <article class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="font-semibold">Plan mix</h2>
        <div class="mt-5 space-y-4">
          <div v-for="plan in planOrder" :key="plan" class="flex items-center gap-3">
            <span class="w-24 text-sm capitalize text-slate-600 dark:text-slate-300">{{ plan }}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-primary" :style="{ width: planWidth(plan) }" /></div>
            <span class="w-7 text-right text-sm font-semibold">{{ overview?.plans[plan] || 0 }}</span>
          </div>
        </div>
      </article>
      <article class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="font-semibold">Newest workspaces</h2>
        <div class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="organization in overview?.recentOrganizations" :key="organization.id" class="flex items-center justify-between gap-4 py-3 first:pt-1">
            <div><p class="font-medium">{{ organization.name }}</p><p class="text-xs text-slate-500">{{ organization.slug }} · {{ formatDate(organization.createdAt) }}</p></div>
            <UBadge color="neutral" variant="subtle" class="capitalize">{{ organization.subscriptionPlan }}</UBadge>
          </div>
          <p v-if="!overview?.recentOrganizations?.length" class="py-6 text-sm text-slate-500">No workspaces yet.</p>
        </div>
      </article>
    </section>

    <section class="mt-8 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="font-semibold">Customer workspaces</h2><p class="mt-1 text-sm text-slate-500">Plan changes are immediately enforced and recorded in the workspace audit log.</p></div><UInput v-model="search" icon="i-lucide-search" placeholder="Search name or workspace slug" class="w-full sm:w-72" /></div>
      <div class="overflow-x-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/40"><tr><th class="px-5 py-3 font-medium">Workspace</th><th class="px-5 py-3 font-medium">Usage</th><th class="px-5 py-3 font-medium">Created</th><th class="px-5 py-3 font-medium">Plan</th></tr></thead><tbody class="divide-y divide-slate-100 dark:divide-slate-800"><tr v-for="organization in filteredOrganizations" :key="organization.id"><td class="px-5 py-4"><p class="font-medium">{{ organization.name }}</p><p class="text-xs text-slate-500">{{ organization.slug }}</p></td><td class="px-5 py-4 text-slate-600 dark:text-slate-300">{{ organization.students }} students · {{ organization.dojos }} dojos · {{ organization.users }} users</td><td class="px-5 py-4 text-slate-500">{{ formatDate(organization.createdAt) }}</td><td class="px-5 py-4"><USelect v-model="organization.subscriptionPlan" :items="planOptions" size="sm" class="w-36" :loading="savingId === organization.id" @update:model-value="changePlan(organization)" /></td></tr><tr v-if="!filteredOrganizations.length"><td colspan="4" class="px-5 py-10 text-center text-slate-500">No workspaces match your search.</td></tr></tbody></table></div>
    </section>

    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 class="font-semibold">Platform account controls</h2>
      <p class="mt-1 text-sm text-slate-500">Suspend, manage accounts, or permanently remove a workspace.</p>
      <div class="mt-4 flex flex-wrap gap-2"><UButton v-for="organization in organizations" :key="organization.id" size="sm" variant="outline" @click="manageOrganization(organization)">Manage {{ organization.name }}</UButton></div>
    </section>

    <section v-if="selectedOrganization" class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-start justify-between gap-4"><div><h2 class="font-semibold">Manage {{ selectedOrganization.name }}</h2><p class="mt-1 text-sm text-slate-500">Type the workspace slug to authorize permanent deletion.</p></div><UButton size="sm" variant="ghost" @click="selectedOrganization = null">Close</UButton></div>
      <div class="mt-5 flex flex-wrap gap-3"><UButton variant="outline" :loading="actionLoading" @click="changeWorkspaceSlug">Change workspace address</UButton><UButton :color="selectedOrganization.subscriptionStatus === 'suspended' ? 'primary' : 'warning'" variant="outline" :loading="actionLoading" @click="toggleSuspension">{{ selectedOrganization.subscriptionStatus === 'suspended' ? 'Reactivate workspace' : 'Suspend workspace' }}</UButton><UButton color="error" variant="outline" :loading="actionLoading" @click="deleteOrganization">Permanently delete workspace</UButton></div>
      <div class="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800"><h3 class="font-medium">Organization accounts</h3><div class="mt-3 space-y-3"><div v-for="member in organizationUsers" :key="member.id" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800"><div><p class="font-medium">{{ member.name }} <span class="text-sm font-normal text-slate-500">({{ member.role.replace('_', ' ') }})</span></p><p class="text-sm text-slate-500">{{ member.email }}</p></div><div class="flex gap-2"><UButton size="xs" variant="ghost" @click="resetPassword(member)">Reset password</UButton><UButton v-if="member.role !== 'owner'" size="xs" variant="ghost" @click="makeOwner(member)">Make owner</UButton><UButton v-if="member.role !== 'owner'" size="xs" color="error" variant="ghost" @click="deleteUser(member)">Delete</UButton></div></div><p v-if="!organizationUsers.length" class="text-sm text-slate-500">No accounts found.</p></div></div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'platform-admin'] })
type Plan = 'free' | 'city-starter' | 'city-pro' | 'state-pro' | 'national'
type SubscriptionStatus = 'free' | 'trialing' | 'active' | 'cancelled' | 'expired' | 'suspended'
type Organization = { id: number, name: string, slug: string, subscriptionPlan: Plan, subscriptionStatus: SubscriptionStatus, createdAt: string, users: number, students: number, dojos: number }
type OrganizationUser = { id: number, name: string, email: string, role: string, createdAt: string }
type Overview = { totals: { organizations: number, users: number, students: number, dojos: number }, plans: Record<string, number>, revenue: { estimatedMrr: number, estimatedArr: number, payingWorkspaces: number, customEnterpriseWorkspaces: number }, recentOrganizations: Array<Pick<Organization, 'id' | 'name' | 'slug' | 'subscriptionPlan' | 'createdAt'>> }
const { data: overview, refresh: refreshOverview } = await useFetch<Overview>('/api/platform/overview')
const { data: organizations, refresh: refreshOrganizations } = await useFetch<Organization[]>('/api/platform/organizations')
const search = ref('')
const savingId = ref<number | null>(null)
const selectedOrganization = ref<Organization | null>(null)
const organizationUsers = ref<OrganizationUser[]>([])
const actionLoading = ref(false)
const toast = useToast()
const planOrder: Plan[] = ['free', 'city-starter', 'city-pro', 'state-pro', 'national']
const planOptions = planOrder.map(value => ({ label: ({ free: 'Free Forever', 'city-starter': 'City Starter', 'city-pro': 'City Pro', 'state-pro': 'State Pro', national: 'National' }[value]), value }))
const loading = computed(() => !overview.value || !organizations.value)
const cards = computed(() => [
  { label: 'Customer workspaces', value: overview.value?.totals.organizations || 0, icon: 'i-lucide-building-2' },
  { label: 'Platform users', value: overview.value?.totals.users || 0, icon: 'i-lucide-users-round' },
  { label: 'Managed students', value: overview.value?.totals.students || 0, icon: 'i-lucide-graduation-cap' },
  { label: 'Active dojos', value: overview.value?.totals.dojos || 0, icon: 'i-lucide-landmark' },
])
const filteredOrganizations = computed(() => { const term = search.value.trim().toLowerCase(); return (organizations.value || []).filter(item => `${item.name} ${item.slug}`.toLowerCase().includes(term)) })
function planWidth(plan: Plan) { const total = overview.value?.totals.organizations || 0; return total ? `${((overview.value?.plans[plan] || 0) / total) * 100}%` : '0%' }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) }
function formatInr(value: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value) }
async function refreshAll() { await Promise.all([refreshOverview(), refreshOrganizations()]) }
async function changePlan(organization: Organization) { savingId.value = organization.id; try { await $fetch(`/api/platform/organizations/${organization.id}`, { method: 'PATCH', body: { subscriptionPlan: organization.subscriptionPlan } }); await refreshOverview(); toast.add({ title: `${organization.name} moved to ${organization.subscriptionPlan}`, color: 'success' }) } catch { await refreshOrganizations(); toast.add({ title: 'Could not change the plan', color: 'error' }) } finally { savingId.value = null } }
async function manageOrganization(organization: Organization) { selectedOrganization.value = organization; try { organizationUsers.value = await $fetch<OrganizationUser[]>(`/api/platform/organizations/${organization.id}/users`) } catch { organizationUsers.value = []; toast.add({ title: 'Could not load organization accounts', color: 'error' }) } }
async function toggleSuspension() { const organization = selectedOrganization.value; if (!organization) return; const suspended = organization.subscriptionStatus !== 'suspended'; if (!confirm(`${suspended ? 'Suspend' : 'Reactivate'} ${organization.name}?`)) return; actionLoading.value = true; try { const updated = await $fetch<Organization>(`/api/platform/organizations/${organization.id}/suspension`, { method: 'PUT', body: { suspended } }); Object.assign(organization, updated); await refreshOrganizations(); toast.add({ title: suspended ? 'Workspace suspended' : 'Workspace reactivated', color: 'success' }) } catch (error: any) { toast.add({ title: error?.data?.statusMessage || 'Action failed', color: 'error' }) } finally { actionLoading.value = false } }
async function changeWorkspaceSlug() { const organization = selectedOrganization.value; if (!organization) return; const slug = prompt(`Set a short workspace address for ${organization.name}:`, organization.slug); if (slug === null || slug.trim() === organization.slug) return; actionLoading.value = true; try { const updated = await $fetch<Pick<Organization, 'slug'>>(`/api/platform/organizations/${organization.id}`, { method: 'PATCH', body: { slug } }); organization.slug = updated.slug; await refreshOrganizations(); toast.add({ title: `Workspace address changed to ${updated.slug}`, color: 'success' }) } catch (error: any) { toast.add({ title: error?.data?.statusMessage || 'Could not change workspace address', color: 'error' }) } finally { actionLoading.value = false } }
async function deleteOrganization() { const organization = selectedOrganization.value; if (!organization) return; const confirmation = prompt(`Permanently delete ${organization.name}? Type its workspace slug exactly: ${organization.slug}`); if (confirmation === null) return; actionLoading.value = true; try { const result = await $fetch<{ uploadFailures: number }>(`/api/platform/organizations/${organization.id}`, { method: 'DELETE', body: { confirmation } }); selectedOrganization.value = null; organizationUsers.value = []; await refreshAll(); toast.add({ title: result.uploadFailures ? 'Workspace deleted; some uploads require manual cleanup' : 'Workspace permanently deleted', color: result.uploadFailures ? 'warning' : 'success' }) } catch (error: any) { toast.add({ title: error?.data?.statusMessage || 'Deletion failed', color: 'error' }) } finally { actionLoading.value = false } }
async function makeOwner(member: OrganizationUser) { const organization = selectedOrganization.value; if (!organization || !confirm(`Make ${member.email} the owner of ${organization.name}? The current owner becomes an administrator.`)) return; actionLoading.value = true; try { await $fetch(`/api/platform/organizations/${organization.id}/owner`, { method: 'PUT', body: { newOwnerUserId: member.id } }); await manageOrganization(organization); toast.add({ title: 'Organization owner reassigned', color: 'success' }) } catch (error: any) { toast.add({ title: error?.data?.statusMessage || 'Could not reassign owner', color: 'error' }) } finally { actionLoading.value = false } }
async function resetPassword(member: OrganizationUser) { const organization = selectedOrganization.value; if (!organization) return; const password = prompt(`Set a new temporary password for ${member.email} (12+ characters):`); if (!password) return; actionLoading.value = true; try { await $fetch(`/api/platform/organizations/${organization.id}/users/${member.id}/password`, { method: 'PUT', body: { password } }); toast.add({ title: 'Password reset', color: 'success' }) } catch (error: any) { toast.add({ title: error?.data?.statusMessage || 'Password reset failed', color: 'error' }) } finally { actionLoading.value = false } }
async function deleteUser(member: OrganizationUser) { const organization = selectedOrganization.value; if (!organization || !confirm(`Permanently delete ${member.email}?`)) return; actionLoading.value = true; try { await $fetch(`/api/platform/organizations/${organization.id}/users/${member.id}`, { method: 'DELETE' }); await manageOrganization(organization); await refreshAll(); toast.add({ title: 'Account deleted', color: 'success' }) } catch (error: any) { toast.add({ title: error?.data?.statusMessage || 'Could not delete account', color: 'error' }) } finally { actionLoading.value = false } }
</script>
