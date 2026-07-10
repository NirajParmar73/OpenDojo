// shared/types/auth.d.ts
declare module '#auth-utils' {
  interface User {
    id: number
    name: string
    email: string
    role: string
    organizationId: number | null
    organizationName: string | null
    organizationLogo: string | null // 👈 add this
    avatar: string | null
  }

  interface UserSession {
    lastLoggedIn: Date
  }

  interface SecureSessionData {
    // add any extra fields
  }
}
export {}