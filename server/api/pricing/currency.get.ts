export default defineEventHandler((event) => {
  // These headers are supplied by common deployment platforms. They are used
  // only to choose a display currency, never for payment or access decisions.
  const country = [
    getRequestHeader(event, 'cf-ipcountry'),
    getRequestHeader(event, 'x-vercel-ip-country'),
    getRequestHeader(event, 'cloudfront-viewer-country'),
    getRequestHeader(event, 'x-geo-country'),
  ].find(value => value?.trim())?.trim().toUpperCase()

  return { currency: country === 'IN' ? 'INR' : country ? 'USD' : null }
})
