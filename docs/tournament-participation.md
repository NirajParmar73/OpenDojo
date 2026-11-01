# Tournament participation

Open **Operations → Tournament setup** (`/tournaments`) as an organization owner, admin, location manager, dojo manager, or assigned instructor. Managers and instructors select participating locations from their assignments; owners and admins can also create organization-wide forms. Location scope is fixed after creation. Enter the tournament name, level, dates, age cut-off, participant-list heading, and coach. Creating the tournament also creates a public participation link. Copy it from the tournament card and share it with players. Existing tournaments can generate their link from the same card.

The form at `/tournament-registration/<token>` accepts one player at a time without signing in. It collects Name, DOB, Weight in kg, Belt, M/F, Category, and Kata/Kumite selections. Age is calculated on the tournament's age cut-off date. The belt dropdown loads the configured ranks from all of this organization's belt systems, in system/rank order, with duplicate names shown once. Custom belt names are preserved in the participation record and Excel export. Brown/Black names or colors and Dan ranks enter the brown/black list; other ranks enter the colour list. Public submissions and administrator belt changes are validated against the organization's current ranks. If no belts are configured, the public page asks players to contact the administrator. Previously registered belts remain editable after a rank is removed, retaining their recorded division. A player may enter either event or both. Category is entered according to the coach's competition rules, rather than guessed from age.

Submissions are saved transactionally in `tournament_participants`, with one `student_achievements` event entry per selected event. They appear in tournament setup and tournament results immediately on refresh; the results screen also refreshes every 30 seconds while visible and preserves unsaved result changes. New entries have Pending placement. A single, exact normalized name and DOB match within the organization and the form's participating locations links the participation to the existing student. Anonymous registration never creates an admitted student or changes the student's profile. Players without a matching student record are still included in the administrator's roster, results, reports, and exports. Managers whose assignments cover every location of a scoped form can see and correct all its public participants, including players without a student record. Staff with partial access see only linked players in their assigned locations. Forms belonging entirely to other locations are hidden. Organization-wide forms remain manageable by owners/admins, while assigned managers and instructors can export their own visible students from those forms. Owners/admins retain complete organization access. Changes to assignments take effect on the next request.

Use **Manage participants → Edit** to correct public participation details. Belt changes move the player between divisions. Event selection updates the results entries and exports. Results for retained events remain intact; deselecting an event deletes that event's result. Removing a public participant removes all of their event entries. Authorized form managers can correct entries and download lists after closing registration.

Use **Close registration** when submissions are complete. The existing shared link then shows a closed message and rejects new submissions. **Reopen registration** restores the same link. Network retries use a request UUID to prevent duplicate entries; a second registration with the same normalized player name and DOB is rejected and directed to the administrator for corrections.

Download **Colour belts .xlsx** and **Brown / Black belts .xlsx** for separate organizer files, or **Both sheets** for one workbook containing both divisions. Downloads are available from setup and results. Each player occupies one row, with Yes/No flags for their selected events. Rows sort by age and name. Empty divisions still include the full headings.

The workbook reproduces the formatting, column widths, merges, and heading positions from `KDF Championship 2025 KGI List Colour Belts.xlsx`. Row 1 is the tournament name, row 3 the configured participant-list heading, row 5 `Coach: <name>`, row 7 the belt division, and row 8 these columns:

| No | Name | Kata | Kumite | DOB | Age (as of &lt;cut-off date&gt;) | Weight | Belt | M/F | Category |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

For the supplied example, enter `KDF State Championship 2025`, `Karate-Do Gojukai India, Ahmedabad Participant List`, coach `Niraj Parmar`, and cut-off `2025-06-11` to reproduce its headings exactly. Formatting is stored in `server/assets/tournament-participation-template.json`; sample player data from the supplied file is excluded. Manually added legacy entries use the student's existing DOB, belt and gender, and the entry's category/weight fields; fill missing details before sending the organizer's file.

Apply PostgreSQL migrations through `0044_tournament_location_scope` before running this version. The scope migration adds participating location IDs; existing tournaments retain organization-wide scope. The earlier `0043_tournament_public_participation` migration adds registration settings and the participant table, allows event entries for players without a student record, and defaults existing list headings to the organization name. New links use 32 random bytes; public endpoints expose tournament details only, never a roster. Public submissions use the app's origin checks and request rate limits.

Validation:

```text
pnpm test
pnpm lint
bun run tests/tournaments.integration.ts
pnpm run typecheck
pnpm run build
```

The integration test requires a local PostgreSQL `DATABASE_URL`. It creates and removes its own uniquely named test database; it never seeds or migrates the configured application database. Set `TOURNAMENT_HTTP_TEST=1` after building to additionally exercise real public/admin HTTP routes against the disposable database.
