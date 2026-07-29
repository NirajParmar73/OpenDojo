# Nuxt Starter Template

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)

Use this template to get started with [Nuxt UI](https://ui.nuxt.com) quickly.

- [Live demo](https://starter-template.nuxt.dev/)
- [Documentation](https://ui.nuxt.com/docs/getting-started/installation/nuxt)

<a href="https://starter-template.nuxt.dev/" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png">
    <img alt="Nuxt Starter Template" src="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png" width="830" height="466">
  </picture>
</a>

> The starter template for Vue is on https://github.com/nuxt-ui-templates/starter-vue.

## Quick Start

```bash [Terminal]
npm create nuxt@latest -- -t ui
```

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-name=starter&repository-url=https%3A%2F%2Fgithub.com%2Fnuxt-ui-templates%2Fstarter&demo-image=https%3A%2F%2Fui.nuxt.com%2Fassets%2Ftemplates%2Fnuxt%2Fstarter-dark.png&demo-url=https%3A%2F%2Fstarter-template.nuxt.dev%2F&demo-title=Nuxt%20Starter%20Template&demo-description=A%20minimal%20template%20to%20get%20started%20with%20Nuxt%20UI.)

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Multi-tenant production setup

OpenDojo separates its public, platform, staff, and student applications by hostname:

```text
your-domain.com                 Public website
platform.your-domain.com        SaaS platform administration
app.your-domain.com             General staff application
tenant.your-domain.com          Tenant-branded staff application
portal.your-domain.com          General student portal
tenant.portal.your-domain.com   Tenant-branded student portal
```

Configure DNS and TLS for the apex domain, `*.your-domain.com`, and `*.portal.your-domain.com`. A wildcard such as `*.your-domain.com` does not cover `tenant.portal.your-domain.com`, and `*.*.your-domain.com` is not a portable recursive wildcard. All names may route to the same OpenDojo service, but the proxy must preserve the original `Host` or `X-Forwarded-Host` header.

Set:

```env
NUXT_TENANT_BASE_DOMAIN=your-domain.com
NUXT_PUBLIC_TENANT_BASE_DOMAIN=your-domain.com
NUXT_PUBLIC_APP_URL=https://app.your-domain.com
NUXT_ENFORCE_APP_SUBDOMAINS=true
```

Do not set `NUXT_SESSION_COOKIE_DOMAIN`. OpenDojo intentionally uses secure host-only cookies so a platform, staff, or student login cannot replace another application's session. The general staff application remains on `app.your-domain.com`; tenant-branded workspaces can be entered directly at `tenant.your-domain.com`.

The global tenant middleware resolves both staff and student tenant hostnames, rejects unknown organizations, enforces application-surface boundaries, and rejects sessions belonging to another organization. New organizations receive a sanitized, reserved-name-safe slug. Student access is invitation-only: authorized managers create or disable credentials from **Student profile → Portal access**.

## Renovate integration

Install [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) on your repository and you are good to go.
