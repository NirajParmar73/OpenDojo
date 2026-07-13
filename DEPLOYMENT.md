# Production deployment

OpenDojo now uses PostgreSQL. The SQLite database is intentionally not migrated, so a new installation starts with no organizations, users, or test records.

## Required environment variables

Set these in `.env` locally and in your VPS service manager or secret store:

```env
DATABASE_URL=postgresql://APP_USER:APP_PASSWORD@127.0.0.1:5432/opendojo
NUXT_SESSION_PASSWORD=use-a-unique-random-secret-of-at-least-32-characters
NUXT_PUBLIC_LEGAL_ENTITY_NAME=Your legal business name
NUXT_PUBLIC_SUPPORT_EMAIL=support@your-domain.com
```

Set `NUXT_PUBLIC_SUPPORT_PHONE`, `NUXT_PUBLIC_LEGAL_ADDRESS`, and `NUXT_TENANT_BASE_DOMAIN` when applicable. Do not commit `.env` or user uploads.

## First PostgreSQL setup

Create a dedicated, non-superuser PostgreSQL role on the VPS, grant it ownership of the `opendojo` database, then run:

```bash
bun install --frozen-lockfile
bun run migrations:migrate
bun run build
NODE_ENV=production bun .output/server/index.mjs
```

Run migrations before each application release. Back up PostgreSQL and the persistent upload directory before upgrades.

## VPS checklist

- Put the application behind HTTPS (for example, Nginx or Caddy) and keep PostgreSQL private to the server.
- Persist `public/uploads` outside release directories and restore it during deploys.
- Run the app with a process manager such as systemd and set `NODE_ENV=production`.
- Use a unique database account for the app; do not use the PostgreSQL `postgres` administrator account in production.
- Configure automated PostgreSQL backups and verify a restore before accepting live data.
