import { eq } from 'drizzle-orm'
import { db, tables } from './database'

type LocationDetails = { city?: string, stateProvince?: string, country?: string }

export async function getLocationFromHierarchyNode(organizationId: number, nodeId: number, topLocationIsCountry = false): Promise<LocationDetails> {
  const [nodes, levels] = await Promise.all([
    db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId) }),
    db.query.hierarchyLevels.findMany({ where: eq(tables.hierarchyLevels.organizationId, organizationId) }),
  ])
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const levelsById = new Map(levels.map(level => [level.id, level.name.trim().toLowerCase()]))
  const location: LocationDetails = {}
  let current = nodesById.get(nodeId)
  let topLocation = current

  while (current) {
    const levelName = levelsById.get(current.levelId)
    if (levelName === 'city / town' && !location.city) location.city = current.name
    if (levelName === 'state / province' && !location.stateProvince) location.stateProvince = current.name
    if (levelName === 'country' && !location.country) location.country = current.name
    topLocation = current
    current = current.parentId ? nodesById.get(current.parentId) : undefined
  }

  // Older National workspaces may use a country-named top location that was
  // created before the dedicated Country location type existed.
  if (topLocationIsCountry && !location.country && topLocation) location.country = topLocation.name
  return location
}
