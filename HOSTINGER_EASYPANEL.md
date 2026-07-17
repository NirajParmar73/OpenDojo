# Publish OpenDojo with Hostinger VPS + EasyPanel

This is the simplest first deployment: one website at `opendojos.com`, one PostgreSQL database, and HTTPS managed by EasyPanel. Do not enable tenant subdomains until the basic site is working.

## 1. Prepare the VPS

1. In Hostinger hPanel, open **VPS** and create or reinstall a VPS using the **Ubuntu 24.04 with EasyPanel** template.
2. Copy the VPS IPv4 address from the VPS overview.
3. Open `http://YOUR_VPS_IP:3000` in a browser and create your EasyPanel administrator account. Save this password in a password manager.

## 2. Point the domain to the VPS

In Hostinger go to **Domains → Domain Portfolio → opendojos.com → Manage → DNS / Nameservers**.

Delete any existing records for `@` and `www` that point somewhere else, then add:

| Type | Name | Points to |
| --- | --- | --- |
| A | @ | your VPS IPv4 address |
| A | www | your VPS IPv4 address |

DNS can take up to 24 hours. Do not use an `AAAA` record unless your VPS has a configured IPv6 address.

## 3. Put this project on GitHub

1. Create a **private** GitHub repository.
2. Commit and push this project. Never add `.env` to GitHub.
3. The included `Dockerfile` is what EasyPanel will use. It builds Nuxt, runs database migrations, then starts the app.

## 4. Create the EasyPanel project and database

1. In EasyPanel, choose **New Project** and name it `opendojo`.
2. Click **+ Service → Postgres**. Name it `database`, choose a strong database password, and deploy it.
3. Open the Postgres service's **Credentials** section and copy its *internal connection URL*. Keep it private; do not expose PostgreSQL on a public port.

## 5. Create the application service

1. Click **+ Service → App** and name it `web`.
2. In **Source**, connect the GitHub repository and select your main branch.
3. In **Build**, select **Dockerfile** and use `Dockerfile` at the repository root.
4. In **Environment**, add the following values. Paste the database URL copied in step 4; do not use the example value.

```env
DATABASE_URL=PASTE_THE_INTERNAL_POSTGRES_CONNECTION_URL_HERE
NUXT_SESSION_PASSWORD=GENERATE_A_NEW_64_CHARACTER_RANDOM_VALUE
PLATFORM_ADMIN_EMAILS=your-real-admin-email@example.com
NUXT_PUBLIC_LEGAL_ENTITY_NAME=Your business name
NUXT_PUBLIC_SUPPORT_EMAIL=your-support-email@example.com
NUXT_PUBLIC_SUPPORT_PHONE=
NUXT_PUBLIC_LEGAL_ADDRESS=
NUXT_TENANT_BASE_DOMAIN=
NUXT_SESSION_COOKIE_DOMAIN=
```

Generate the session password on your own computer with `openssl rand -hex 32`, or use a password manager generator. Keep it unchanged after the first deployment; changing it signs everyone out.

5. In **Mounts**, add a **Volume** named `uploads` at `/app/public/uploads`. This keeps logos, documents, and avatars after redeployments.
6. In **Domains & Proxy**, add `opendojos.com` with proxy port `3000`. Add `www.opendojos.com` too if you want it to work; choose one as the primary domain and redirect the other to it.
7. Click **Deploy**. EasyPanel obtains the HTTPS certificate after DNS reaches the VPS.

## 6. First checks

1. Open the EasyPanel **Logs** tab. A successful start ends with Nuxt listening on port 3000; migration output should not contain errors.
2. Open `https://opendojos.com` and create a test organization.
3. Sign in using the email listed in `PLATFORM_ADMIN_EMAILS`, then open `/platform` to verify platform-owner access.
4. Upload a test logo, redeploy once, and confirm that it remains. This verifies the persistent uploads volume.

## Later: tenant subdomains

After the main site is working, add a wildcard DNS record `*.opendojos.com` pointing to the VPS and configure a wildcard TLS certificate in your proxy/DNS provider. Only then set:

```env
NUXT_TENANT_BASE_DOMAIN=opendojos.com
NUXT_SESSION_COOKIE_DOMAIN=.opendojos.com
```

This enables addresses such as `demo.opendojos.com`. Keep it blank for the first deployment.

## Ongoing care

- Enable Hostinger backups and make regular PostgreSQL backups before upgrades.
- Do not expose port 5432 publicly.
- Update the application by pushing to GitHub and using EasyPanel's deploy button (or enable auto-deploy once the first release works).
- Store VPS, EasyPanel, GitHub, and database passwords in a password manager.
