// https://nuxt.com/docs/api/configuration/nuxt-config
const appVersion = process.env.NUXT_PUBLIC_APP_VERSION || new Date().toISOString()

export default defineNuxtConfig({
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils'],

  devtools: {
    enabled: process.env.NODE_ENV !== 'production'
  },

  css: ['~/assets/css/main.css'],

  vite: {
    optimizeDeps: {
      include: ['zod/v4']
    }
  },

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
      tenantBaseDomain: process.env.NUXT_TENANT_BASE_DOMAIN || process.env.NUXT_PUBLIC_TENANT_BASE_DOMAIN || '',
      enforceAppSubdomains: process.env.NUXT_ENFORCE_APP_SUBDOMAINS === 'true',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || '',
      razorpayKeyId: process.env.NUXT_RAZORPAY_KEY_ID || '',
      razorpayKeySecret: process.env.NUXT_RAZORPAY_KEY_SECRET || '',
      public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || '',
      tenantBaseDomain: process.env.NUXT_PUBLIC_TENANT_BASE_DOMAIN || process.env.NUXT_TENANT_BASE_DOMAIN || '',
      legalEntityName: process.env.NUXT_PUBLIC_LEGAL_ENTITY_NAME || 'OpenDojos',
      supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || 'opendojos@gmail.com',
      supportPhone: process.env.NUXT_PUBLIC_SUPPORT_PHONE || '',
      legalAddress: process.env.NUXT_PUBLIC_LEGAL_ADDRESS || '',
      razorpayKeyId: process.env.NUXT_RAZORPAY_KEY_ID || '',
      appVersion
    },
    session:{
      password: '',
      // Host-only cookies keep platform, staff, and student sessions isolated.
      // The production __Host- prefix also prevents a subdomain from replacing
      // another application's session cookie.
      name: process.env.NODE_ENV === 'production' ? '__Host-opendojos-session' : 'opendojos-session',
      maxAge: 60 * 60 * 24 * 365,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
        path: '/',
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
