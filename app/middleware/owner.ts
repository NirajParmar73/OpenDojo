export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()

  if (user.value?.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can manage the subscription.' })
  }
})
