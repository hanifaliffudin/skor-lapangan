# Club Sessions and Tournament Mode

Status: the Badminton doubles MVP is implemented in application code. The Supabase migration is not yet applied, and the feature is not deployed or approved for production.

## Product hypothesis

An organizer running casual play across several courts needs a lightweight place to manage the roster, assignments, queue, and results without replacing the existing scorekeeper. Validate the workflow with club organizers before expanding its scope.

## MVP decisions

- Start with organizer-led open play, Badminton doubles only, using Official Rules.
- Require one signed-in Google account to own and manage each private session. Players do not need accounts.
- Keep pairings, court assignments, and queue order manual. Do not add automatic rotations or tournament brackets.
- Show played, won, and lost counts in original roster order. Do not rank players or apply tie-break rules.
- Count only completed matches that have synced to the server. Keep the existing match journal as the source of truth.
- Do not publish session rosters, session results, or aggregate scoreboards. Existing Live Viewer links remain scoped to individual matches and do not expose player names.
- A session stays stored until its owner deletes it or deletes their account. Deleting a session removes its roster, courts, and links, but leaves match journals in account history.

## Organizer flow

1. Create a session with a name and date.
2. Add player display names and court labels. Entries can be deactivated without breaking past assignments.
3. Add a queued match by choosing a court and four distinct players. The selection order defines the two sides.
4. Start or resume the queue entry through the existing setup and scorekeeping screens. The planned match UUID connects it to its synced match journal.
5. Return to the session board to see match state and player records, then complete or reopen the session.

## Persistence and privacy

The migration creates owner-scoped session, player, court, and queue tables with RLS, validation, and indexes. Player and court records use stable IDs. Match results are derived from completed account-owned matches rather than copied into a second score store. Session rows do not use guest-match expiry. Account deletion cascades through session-owned data.

Player names are personal data. They are private to the organizer's account in the session board and are not added to the Live Viewer projection. Names are copied into the match definition for the existing account match journal. Review the privacy notice and actual deployed behavior before public rollout.

## Implementation status

- [x] Create sessions and list the owner's sessions.
- [x] Add, deactivate, and reactivate players and courts.
- [x] Manually assign four distinct players to a court and queue the match.
- [x] Launch the existing setup/scoring flow with the roster names and stable match ID.
- [x] Resume started entries; attach match records after their first server sync.
- [x] Derive played/won/lost counts without ranking, and exclude results that are incomplete or not yet synced.
- [x] Complete, reopen, or delete a session without deleting its match journals.
- [x] Add account-only RLS and account-deletion cascade in the migration.
- [ ] Apply the migration in Supabase before deploying code that queries these tables.
- [ ] Verify RLS isolation, deletion, sync recovery, accessibility, mobile court-side use, and pending/error states in Preview.
- [ ] Run a small club pilot and have the owner/legal reviewer approve the privacy notice before production.

## Follow-up decisions

- Confirm with pilot clubs whether to add doubles rotation, round-robin scheduling, or additional sports.
- Consider multi-organizer permissions only if one-owner operation proves limiting.
- Keep brackets, public event pages, player accounts, and cross-session player statistics out of scope until a pilot establishes demand.
