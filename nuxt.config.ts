// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/hierarchy/levels': { redirect: '/settings/hierarchy/levels' },
    '/hierarchy/nodes': { redirect: '/settings/hierarchy/nodes' },
  },


  runtimeConfig:{
    session:{
      password: '',
      name: 'nau-session',
      cookie: {
        maxAge: 60 * 24 * 7,
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