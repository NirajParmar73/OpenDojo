// server/database/index.ts
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'
import * as relations from './relations'

const client = createClient({ url: 'file:./database.sqlite' })
export const db = drizzle(client, { schema: { ...schema, ...relations } })

export const tables = schema