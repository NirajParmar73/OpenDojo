import { platformAppUrl, portalAppUrl, staffAppUrl } from '#shared/utils/app-host'

export function useApplicationUrls() {
  const config = useRuntimeConfig()
  const baseDomain = computed(() => String(config.public.tenantBaseDomain || ''))

  return {
    staffSignInUrl: computed(() => staffAppUrl(baseDomain.value, '/auth/login')),
    studentPortalUrl: computed(() => portalAppUrl(baseDomain.value)),
    platformUrl: computed(() => platformAppUrl(baseDomain.value)),
  }
}
