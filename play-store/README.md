# OpenDojos Google Play release

This repository contains two Trusted Web Activity (TWA) Android projects. The existing web applications remain installable PWAs.

| App | Package ID | Verified web origin | Android project |
| --- | --- | --- | --- |
| OpenDojos Admin | `com.opendojos.admin` | `https://app.opendojos.com` | `android/admin` |
| OpenDojos Student | `com.opendojos.student` | `https://portal.opendojos.com` | `android/student` |

Both projects compile and target Android API 36. Package IDs are permanent after the first Play upload; confirm them before creating the Play Console apps.

## Build signed app bundles

Install JDK 17 and Android SDK 36. Create a different upload keystore for each app and keep both outside Git. Update each `signingKey.path` and alias in its `twa-manifest.json`, then run from the repository root:

```powershell
cd android/admin
pnpm dlx @bubblewrap/cli build
cd ../student
pnpm dlx @bubblewrap/cli build
```

Bubblewrap prompts for keystore passwords and writes an `.aab`. Never commit the keystore, its passwords, `local.properties`, AABs, or APKs. Back up both upload keys securely. Use Google Play App Signing for both apps.

For every release, increment `appVersionCode` (it must always increase) and update `appVersionName` in `twa-manifest.json`, run `bubblewrap update`, then build the new AAB.

## Establish verified full-screen TWAs

1. Upload each AAB to its Play internal-testing track and enable Play App Signing.
2. Copy each app's **App signing key certificate SHA-256 fingerprint** from Play Console, not only the local upload-key fingerprint.
3. Configure production:

   - `ANDROID_ADMIN_SHA256_FINGERPRINTS=<admin Play signing SHA-256>`
   - `ANDROID_STUDENT_SHA256_FINGERPRINTS=<student Play signing SHA-256>`

   Multiple fingerprints may be comma-separated for local and Play-signed testing.
4. Deploy the web app and confirm both URLs return the matching package and certificate:

   - `https://app.opendojos.com/.well-known/assetlinks.json`
   - `https://portal.opendojos.com/.well-known/assetlinks.json`

Without the correct Digital Asset Links response, Android opens a Custom Tab with browser chrome instead of a trusted full-screen app.

## Required Play Console work

Complete [release-checklist.md](release-checklist.md) separately for both apps. Store copy is in the corresponding listing files and shared disclosure guidance is in [data-safety.md](data-safety.md).

The student app requires a deliberate target-audience decision. A TWA is not suitable for declaring an under-13-only app. If children under 13 are part of the target audience, obtain specialist Play Families/privacy review and implement any required guardian/consent design before submission; do not choose an inaccurate age group merely to pass review.
