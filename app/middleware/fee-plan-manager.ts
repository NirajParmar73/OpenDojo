export default defineNuxtRouteMiddleware(async () => {
  const { user } = useUserSession()

  if (['owner', 'admin'].includes(user.value?.role || '')) return

  const dojos = await $fetch<unknown[]>('/api/dojos').catch(() => [])
  if (!dojos.length) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have a dojo territory in which to manage fee plans.' })
  }
})
