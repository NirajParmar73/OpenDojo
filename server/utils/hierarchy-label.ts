/**
 * Keeps geographic hierarchy labels unambiguous without changing the stored
 * geographic name (for example, both a district and city may be Ahmedabad).
 */
export function formatHierarchyNodeLabel(name: string, levelName?: string | null) {
  const normalizedLevel = levelName?.trim().toLowerCase()
  let suffix = levelName?.trim()
  if (normalizedLevel === 'city / town') {
    suffix = 'City'
  } else if (normalizedLevel === 'state / province') {
    suffix = 'State / Province'
  }
  if (!suffix) return name
  return name.trim().toLowerCase().endsWith(suffix.toLowerCase()) ? name : `${name} ${suffix}`
}
