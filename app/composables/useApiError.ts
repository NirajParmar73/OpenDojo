export function apiErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (!error || typeof error !== 'object') return fallback
  const candidate = error as {
    message?: string
    statusMessage?: string
    data?: { message?: string, statusMessage?: string }
  }
  return candidate.data?.statusMessage
    || candidate.data?.message
    || candidate.statusMessage
    || candidate.message
    || fallback
}
