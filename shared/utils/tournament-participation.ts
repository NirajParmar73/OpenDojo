export const participationCategories = ['U-12', 'U-14', 'Subjunior', 'Cadet', 'Junior', 'U-21', 'Senior']

export type TournamentBeltOption = { label: string, value: string, division: 'colour' | 'brown_black' }

export function beltDivision(belt: string, rank?: { type: string, color: string | null }): 'colour' | 'brown_black' {
  const color = rank?.color?.trim().toLowerCase()
  const brownOrBlackHex = ['#000', '#000000', '#a52a2a', '#8b4513', '#964b00'].includes(color || '')
  return rank?.type === 'dan' || brownOrBlackHex || /\b(brown|black)\b/i.test(`${belt} ${color || ''}`) ? 'brown_black' : 'colour'
}

export function tournamentBeltOptions(ranks: { name: string, type: string, color: string | null }[]): TournamentBeltOption[] {
  const options = new Map<string, TournamentBeltOption>()
  for (const rank of ranks) {
    const division = beltDivision(rank.name, rank)
    const previous = options.get(rank.name)
    options.set(rank.name, { label: rank.name, value: rank.name, division: previous?.division === 'brown_black' ? previous.division : division })
  }
  return [...options.values()]
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
