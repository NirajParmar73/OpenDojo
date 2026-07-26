// Compatibility route retained for existing bookmarks and integrations.
// Receipt authorization and PDF rendering live in one canonical endpoint.
export default defineEventHandler(async (event) => {
  const studentId = Number(getRouterParam(event, 'studentId'))
  const paymentId = Number(getRouterParam(event, 'id'))
  if (!studentId || !paymentId) throw createError({ statusCode: 400, statusMessage: 'Invalid receipt request' })
  return sendRedirect(event, `/api/payments/${paymentId}/receipt`, 307)
})
