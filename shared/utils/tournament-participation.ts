export const participationBelts = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black'] as const
export const participationCategories = ['U-12', 'U-14', 'Subjunior', 'Cadet', 'Junior', 'U-21', 'Senior']

export function beltDivision(belt: string): 'colour' | 'brown_black' {
  return /\b(brown|black)\b/i.test(belt) ? 'brown_black' : 'colour'
}

export function tournamentAge(dateOfBirth: string | Date, onDate: string | Date): number {
  const birth = new Date(dateOfBirth)
  const date = new Date(onDate)
  let age = date.getUTCFullYear() - birth.getUTCFullYear()
  if (date.getUTCMonth() < birth.getUTCMonth() || (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate())) age--
  return age
}

export function participantIdentity(name: string, dateOfBirth: string) {
  return `${name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()}|${dateOfBirth}`
}
