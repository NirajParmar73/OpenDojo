# Data safety working notes

These notes are a starting point, not a completed declaration. The Play Console answers must match the production deployment, enabled features, retention policy, third-party services, and contracts.

Likely collected data includes account identifiers, names, email addresses, organization and dojo membership, student profile and enrollment data, attendance, fees and payments, receipts, belt/syllabus/grading progress, achievements, staff roles, uploaded files, device push-subscription identifiers, support requests, and security/diagnostic logs.

Review and declare for each app:

- Which data types are collected, shared, optional, or required.
- Whether each type is used for app functionality, account management, communications, fraud prevention/security, analytics, or another purpose.
- Transport encryption, authentication, access controls, retention, backups, and deletion behavior.
- Every processor or integration in production, including hosting, email, database/storage, push delivery, monitoring/analytics, and payment providers.
- Whether payment details are handled by OpenDojos or solely by the payment provider.
- Whether the student app serves children and what parental consent or guardian controls apply.

Users can request deletion in-app and at `https://opendojos.com/account-deletion`. The operations team must verify identity, remove or anonymize applicable live and backup data, preserve only records legally required to be retained, and confirm completion within the published timeframe.
