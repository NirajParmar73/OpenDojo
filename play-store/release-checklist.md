# Release checklist

Complete every applicable item for **each** Play Console app.

## Before upload

- Production, privacy policy, support email, and account-deletion request endpoint are live over HTTPS.
- SMTP variables are configured so deletion requests are delivered and the operational team has a documented identity-verification/deletion process.
- Production passes `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- A unique upload key exists outside the repository and is securely backed up.
- Version code is greater than every version previously uploaded for that package.
- The release AAB targets API 36 and is tested on a physical phone.
- Offline, expired session, login, logout, password reset, notifications, downloads, and back navigation have been tested.
- No web checkout, pricing upgrade call-to-action, or external payment link appears inside the Play-distributed experience.

## Play Console

- Create the apps with exact package IDs from `README.md`; enable Play App Signing.
- Supply app access instructions and durable reviewer demo credentials for both apps.
- Complete the Data safety form from the production system's actual data handling, not solely from sample copy.
- Complete content rating, ads declaration, target audience, privacy policy, and account deletion URL.
- Privacy URL: `https://opendojos.com/privacy`
- Account deletion URL: `https://opendojos.com/account-deletion`
- Add phone/tablet screenshots captured from the final production build, a 512 px icon, and a 1024 x 500 feature graphic.
- State whether an account is required and explain the organization/student invitation flow to reviewers.
- For the student app, accurately declare age groups and complete Families requirements if any selected age group includes children.
- Upload to internal testing first, configure Digital Asset Links with the Play app-signing fingerprints, and verify full-screen TWA behavior.
- Run a closed test if required for the developer account. Personal accounts created after 13 November 2023 generally require at least 12 opted-in testers continuously for 14 days before production access.
- Review pre-launch reports, accessibility findings, policy status, and Android vitals before production rollout.

## Rollout and updates

Use a staged production rollout. Monitor server errors, login failures, deletion requests, policy notices, and Android vitals. Web-only changes normally become available without a new AAB because these apps load the hosted PWA. Publish a new Play release when Android packaging, permissions, icons, package metadata, or other native wrapper behavior changes.
