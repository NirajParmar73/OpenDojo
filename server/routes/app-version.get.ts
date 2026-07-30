export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  return { version: useRuntimeConfig(event).public.appVersion }
})
