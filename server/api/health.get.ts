import { sql } from 'drizzle-orm'
import { db } from '../utils/database'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  try {
    await db.execute(sql`select 1`)
    return {
      status: 'ok',
      database: 'available',
      timestamp: new Date().toISOString(),
    }
  } catch {
    setResponseStatus(event, 503)
    return {
      status: 'unavailable',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    }
  }
})
