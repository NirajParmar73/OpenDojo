import { asc, eq } from 'drizzle-orm'
import { db, tables } from './database'
import { tournamentBeltOptions } from '../../shared/utils/tournament-participation'

type BeltDatabase = Pick<typeof db, 'select'>

export async function tournamentBelts(organizationId: number, database: BeltDatabase = db) {
  const ranks = await database.select({ name: tables.beltRanks.name, type: tables.beltRanks.type, color: tables.beltRanks.color })
    .from(tables.beltRanks)
    .innerJoin(tables.beltSystems, eq(tables.beltRanks.systemId, tables.beltSystems.id))
    .where(eq(tables.beltSystems.organizationId, organizationId))
    .orderBy(asc(tables.beltSystems.id), asc(tables.beltRanks.order), asc(tables.beltRanks.id))
  return tournamentBeltOptions(ranks)
}
