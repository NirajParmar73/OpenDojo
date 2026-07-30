export default defineNuxtRouteMiddleware(async (to) => {
  const session = useUserSession()
  if (!session.ready.value) await session.fetch()

  if (!session.loggedIn.value || session.user.value?.role !== 'student') {
    return navigateTo('/portal/login')
  }
  if (session.user.value.mustChangePassword && to.path !== '/portal/change-password') {
    return navigateTo('/portal/change-password')
  }
})
