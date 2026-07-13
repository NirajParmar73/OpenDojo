import {defineConfig} from 'drizzle-kit'

export default defineConfig({
    dialect: 'postgresql',
    out: './server/database/drizzle-postgres',
    schema: './server/database/schema.ts',
    dbCredentials: {
        url: process.env.DATABASE_URL || '',
    }
})
