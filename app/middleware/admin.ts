export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()

  if (!['owner', 'admin'].includes(user.value?.role || '')) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to organization settings.' })
  }
})
