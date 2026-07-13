import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import * as schema from '../database/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    throw new Error('DATABASE_URL must be configured before the application can start.')
}

const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 5,
    prepare: false,
})

export const db = drizzle(client, {
    schema
})

export const tables = schema

export {and, eq, or} from 'drizzle-orm'
