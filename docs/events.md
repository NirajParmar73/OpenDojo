# Events and camps

Organization owners and admins open **Operations → Events & camps** (`/events`) to create a public event. New events belong to the organization, not a dojo. Their applicants, bookings, payments, costs and profit stay in the event module. They do not create or update student, guardian or tuition records, and they are not shown in the student portal. Pre-existing linked events retain their historical bookings and legacy workflow; new linked events cannot be created.

Configure **Public form and organization-branded invitation** in the event's Settings. Set its title, introduction, accent color, privacy notice, submit label, confirmation message, invitation text/contact details and up to 20 ordered custom questions (short/long text, single choice, date or checkbox). Questions can be required. The organization name and current logo come from Organization settings. The generated invitation PDF includes those details and the event's registration link; it is available even without an uploaded PDF. Optionally upload a separate PDF (up to 5 MB) under **Public requests**. Enable the shareable form and copy its link or use **Share on WhatsApp**. Anyone with the link can submit a student alone or with up to two accompanying adults. City, state and instructor name are required for new public-event applications; club/dojo and country remain optional context, not links to an OpenDojo record. Applicants supply birth date, contact details, preferences, custom answers and consent, then receive a reference number. Custom answer labels are snapshotted on submission so later form edits do not rewrite old answers.

Managers can approve requests one at a time or select up to 100 for bulk approval/rejection. Approval always creates an event-only participant booking, even if the applicant also trains at an organization dojo. There is no student matching step in new events. Each bulk row is handled independently: capacity and duplicate failures are reported against that reference; successful rows remain approved. A submitted request does not reserve space or enter revenue. Approved reserved bookings do; waitlisted bookings do not. Requests can be reviewed after registration closes while the event is open or closed. Disable the form to stop submissions, or replace its link to revoke an old WhatsApp link.

Managers can correct core contact/source details on a submitted request before approval. This is audited and does not alter the applicant's consent or custom answers. Supplier costs can be corrected; amounts and categories are locked after a supplier payment until that payment is refunded. Financial ledger rows and receipts are immutable: record a linked refund and a new entry to correct one. Unused events can be permanently deleted; events with registrations or financial history must be cancelled so their records remain available.

## First event

1. Create an event with dates, registration/details deadlines, venue and participation/cancellation terms.
2. Set separate student and parent base rates. Meals and training can be included in those rates. New events created in the admin form default to self-arranged travel: leave **Organization provides transport** unchecked to remove bus choices, prices and capacities from registration. Accommodation has a per-person price; enter zero when included. If the organization provides transport, enable it and set per-direction prices and seat capacities. Existing events retain their transport setting. Prices are before tax. Monetary storage follows the existing application convention of hundredths of the currency unit.
3. Set capacities for people, beds and outward/return bus seats. Zero means unlimited. Provisional, pending and confirmed bookings reserve capacity. Waiting-list and cancelled bookings do not.
4. Choose staff approval, a deposit per booking, or full payment as the confirmation policy. Complete names, parent relationships, meals, booking contact and consent are always required for confirmation.
5. Open registration. Anyone with the link can request a place without an account or student record. Blank parent names are allowed provisionally. New events ask for a student photo and a signed printed application by default; managers can change either requirement in the event editor.
6. Send the invitation and public link. Applicants can use a phone camera or upload a photo, complete the online form, download their organization-branded PDF, sign it, and submit the hard copy as instructed. The PDF link is private to the applicant's 64-character print token and remains available if the intake link is later disabled. Managers can view the photo/PDF and mark the signed copy received. Events configured to require the hard copy cannot approve individual or bulk requests before that receipt is recorded.
7. Record received family installments in Finance. Settle supplier costs through their own payments. Download booking summaries, payment/refund PDFs and operational CSVs.
8. Fill room/group and bus/pickup assignments in each booking. Use Operations for meal lists, transport manifests, emergency contacts and check-in.
9. Reconcile pending/waitlisted bookings and supplier commitments, then mark the event completed. Booking changes require reopening a completed event; later financial settlements remain available.

Each family booking has one student; siblings register separately. Participants do not receive portal accounts from event registration. The event shows enrolled students, accompanying adults, waiting-list entries, pending requests and payment counts. Optional club, state and country are kept on the event booking for reporting. Payment entries record cash, UPI, transfers, card, cheque or other settlements; there is no automatic payment gateway integration. For a cheque, record payment after it clears. The **Record payment** button on a booking opens the event ledger with that booking and its outstanding balance selected.

## Financial meanings

- Booking prices and terms are snapshotted. Later event rate changes do not reprice existing bookings; changing attendees uses the booking's original rates.
- Provisional event revenue includes reserved booking charges, retained cancellation fees and recorded other income, excluding output tax. Waiting-list quotes are not revenue.
- Gross profit = revenue − direct supplier costs. Net profit before income tax = gross profit − other expenses and allocated overhead.
- Both committed and incurred supplier costs count in the provisional result, including supplier tax. No input-tax credits or income tax are assumed.
- Cash surplus = family payments − refunds + other income − income refunds − supplier payments + supplier refunds. It includes tax still to be settled and is not profit.
- Forecast profit subtracts the greater of the current direct-cost budget and recorded direct costs, plus the greater of overhead budget and recorded overhead.
- Break-even is an estimate using the current booking mix and budgeted per-attendee variable cost. It is not a guaranteed attendance target.
- Event revenue, gross profit, net profit, collections and balances appear in a separate section of the existing Finance overview. Tuition totals are unchanged, and event payments never pay down monthly fees. Public events are organization scoped, independent of tuition filters.
- Fee status is calculated from the ledger as pending, partly paid, paid, no fee, waitlisted or credit due. Marking a family paid requires recording the actual amount, method and date; a status label does not create cash. Booking and request CSV exports include guest source information.

Cancellation preserves the booking and releases its places. The manager explicitly chooses any retained fee before tax. Payments are not automatically refunded: Finance shows the resulting credit, and a refund is recorded against its original payment when actually settled. Each reversal is capped to the unrefunded original amount. Supplier corrections follow the same reversal process; a paid cost cannot be cancelled until its settlements have been refunded.

For a price reduction on an active booking, update its discount before recording the refund. A refund by itself changes cash collected, not the agreed booking charge. Completed events accept late incurred costs, but must be reopened before adding new supplier commitments.

## Deployment and validation

Run `pnpm migrations:migrate` before starting the updated application, then build/restart normally. Migrations `0033` through `0037` add the event module and its public/print workflow; `0038_generic_organization_events.sql` marks existing events as linked and makes new events organization owned. These migrations do not convert tuition payments, expenses or existing guardian records. Existing pending migrations are applied in order by Drizzle.

The new foreign keys preserve existing dojo deletion (booking dojo links become null) and permanent workspace deletion (event data cascades). Cross-branch references are explicitly deferred in the SQL migration to allow workspace cascades in either trigger order. No event/booking/ledger deletion endpoint is exposed.

Validation commands:

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
bun run tests/events.integration.ts
```

The integration test requires a local PostgreSQL connection and permission to create databases. It creates and destroys a uniquely named disposable database, applies all migrations, then exercises registration, capacity races, permissions, guardians, financial reversals and existing deletion workflows. It never migrates or seeds the application's configured database.

Medical notes are available only to the owning student and authorized event staff. General meal/transport exports omit them; emergency exports include them explicitly. Medical notes are excluded from payment receipts and the activity feed. Registration deadlines use Asia/Kolkata calendar dates.
