# Production deployment

OpenDojo now uses PostgreSQL. The SQLite database is intentionally not migrated, so a new installation starts with no organizations, users, or test records.

## Required environment variables

Set these in `.env` locally and in your VPS service manager or secret store:

```env
DATABASE_URL=postgresql://APP_USER:APP_PASSWORD@127.0.0.1:5432/opendojo
NUXT_SESSION_PASSWORD=use-a-unique-random-secret-of-at-least-32-characters
NUXT_PUBLIC_APP_URL=https://app.your-domain.com
NUXT_PUBLIC_LEGAL_ENTITY_NAME=Your legal business name
NUXT_PUBLIC_SUPPORT_EMAIL=support@your-domain.com
NUXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=your-permanent-vapid-public-key
NUXT_WEB_PUSH_PRIVATE_KEY=your-permanent-vapid-private-key
NUXT_WEB_PUSH_SUBJECT=mailto:support@your-domain.com
NUXT_NOTIFICATION_CRON_SECRET=use-a-separate-unique-random-secret
```

Generate the Web Push key pair once with `pnpm push:generate-keys`, store both
values in the production secret store, and keep them unchanged. Replacing the
key pair invalidates devices that already enabled notifications.

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

## Notification scheduler

Immediate announcements are dispatched during publishing. Scheduled
announcements and due fee reminders require a scheduler to call the protected
dispatch endpoint every 15 minutes:

```bash
curl --fail --request POST \
  --header "Authorization: Bearer $NUXT_NOTIFICATION_CRON_SECRET" \
  https://app.your-domain.com/api/internal/notifications/dispatch
```

Use a cron service, VPS system timer, or hosting scheduler. Keep the scheduler
secret out of URLs and logs. Web Push and service workers require HTTPS in
production. On iPhone and iPad, the student must install the PWA to the Home
Screen before enabling device notifications.

## Release gates

Run every gate against the exact commit or image that will be deployed:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm audit --prod
```

Do not deploy when any gate fails. After deployment, request `GET /api/health`; it must return HTTP 200 with both `status` and `database` available. The Docker image includes the same health check.

Before the first public release, complete a staging smoke test over HTTPS:

1. Create Free, Growth, and Business workspaces and confirm their location, student, instructor, and staff limits.
2. Enrol a student with recurring tuition, record tuition plus grading and miscellaneous charges, and verify the receipt and outstanding tuition balance.
3. Schedule a grading, confirm the student's current belt, verify only higher ranks appear, and award a passed and paid candidate.
4. Sign in as a student, install the Student app, expire the session, and confirm it returns to `/portal/login` without exposing staff APIs.
5. Install the staff app and test update, offline fallback, sign-out, Android, iOS/iPadOS, and desktop standalone behavior.
6. Complete a Razorpay live-mode low-value transaction and refund using the production account.

Record the tester, browser/device versions, deployment version, and result. PWA installation and payment-provider checks cannot be certified by source-code tests alone.

## VPS checklist

- Put the application behind HTTPS (for example, Nginx or Caddy) and keep PostgreSQL private to the server.
- Configure the proxy to replace, not append untrusted values to, `X-Forwarded-For` and `X-Forwarded-Host`; request rate limits rely on those trusted proxy headers.
- Persist `public/uploads` outside release directories and restore it during deploys.
- Run the app with a process manager such as systemd and set `NODE_ENV=production`.
- Use a unique database account for the app; do not use the PostgreSQL `postgres` administrator account in production.
- Configure automated PostgreSQL backups and verify a restore before accepting live data.
- Alert on `/api/health` failures and structured server log entries with `"level":"error"`.
- Keep at least one previous application image and a migration-compatible rollback procedure.
