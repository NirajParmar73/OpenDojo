// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils'],

  devtools: {
    enabled: process.env.NODE_ENV !== 'production'
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    // Workflow aliases keep future navigation changes backwards-compatible.
    '/people/students': { redirect: '/students' },
    '/people/staff': { redirect: '/users' },
    '/operations/dojos': { redirect: '/dojos' },
    '/operations/attendance': { redirect: '/attendance' },
    '/finance/fee-plans': { redirect: '/settings/finance/fee-plans' },
    '/insights/attendance': { redirect: '/reports/attendance' },
    '/hierarchy/levels': { redirect: '/settings/hierarchy/levels' },
    '/hierarchy/nodes': { redirect: '/settings/hierarchy/nodes' },
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
      }
    },
    '/api/**': {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
      }
    },
  },


  runtimeConfig:{
    tenantBaseDomain: process.env.NUXT_TENANT_BASE_DOMAIN || '',
    public: {
      legalEntityName: process.env.NUXT_PUBLIC_LEGAL_ENTITY_NAME || 'OpenDojo',
      supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || 'support@your-domain.com',
      supportPhone: process.env.NUXT_PUBLIC_SUPPORT_PHONE || '',
      legalAddress: process.env.NUXT_PUBLIC_LEGAL_ADDRESS || '',
    },
    session:{
      password: '',
      name: 'nau-session',
      cookie: {
        maxAge: 60 * 24 * 7,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      }
    }
  },

  // routeRules: {
  //   '/': { prerender: true }
  // },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
