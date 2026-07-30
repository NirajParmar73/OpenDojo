import { randomInt } from 'node:crypto'

const passwordCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'

function normalizedUsernamePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

export function studentPortalUsername(firstName: string, lastName: string, studentId: number) {
  const name = [normalizedUsernamePart(firstName), normalizedUsernamePart(lastName)].filter(Boolean).join('.') || 'student'
  const suffix = `.${studentId}`
  return `${name.slice(0, 100 - suffix.length).replace(/\.+$/g, '')}${suffix}`
}

export function generateTemporaryPassword(length = 14) {
  const required = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ'[randomInt(24)]!,
    'abcdefghijkmnopqrstuvwxyz'[randomInt(25)]!,
    '23456789'[randomInt(8)]!,
    '!@#$%'[randomInt(5)]!,
  ]
  while (required.length < Math.max(length, 8)) {
    required.push(passwordCharacters[randomInt(passwordCharacters.length)]!)
  }
  for (let index = required.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1)
    ;[required[index], required[swapIndex]] = [required[swapIndex]!, required[index]!]
  }
  return required.join('')
}

export type PortalCredentials = {
  studentId: number
  studentName: string
  username: string
  temporaryPassword: string
}
