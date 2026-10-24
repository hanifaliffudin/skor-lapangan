# Club Sessions and Tournament Mode

Status: Smart Rotation MVP is implemented and its Supabase Preview migration is applied. The existing Badminton doubles club-session board, manual queue, standings, and round-robin compatibility path remain available. The Smart Rotation product contract is recorded in [the PRD](specs/club-session-smart-rotation.md). Pilot validation and owner/legal approval remain open.

## Product hypothesis

An organizer running casual play across several courts needs a lightweight place to manage the roster, assignments, queue, and results without replacing the existing scorekeeper. Validate the workflow with club organizers before expanding its scope.

## MVP decisions

- Start with organizer-led open play, Badminton doubles only, using Official Rules.
- Require one signed-in Google account to own and manage each private session. Players do not need accounts.
- Keep manual queue editing, and offer Smart Rotation for the next free courts. Rotation prioritizes equal match counts, then wait time, pairing variety, avoid preferences, and optional skill balance. Do not add tournament brackets yet.
- Show ranked standings with played, won, lost, and win-rate values. Rank by wins, then win rate, then matches played, with roster order as the stable final tie-break.
- Count only completed matches that have synced to the server. Keep the existing match journal as the source of truth.
- Do not publish session rosters, session results, or aggregate scoreboards. Existing Live Viewer links remain scoped to individual matches and do not expose player names.
- A session stays stored until its owner deletes it or deletes their account. Deleting a session removes its roster, courts, and links, but leaves match journals in account history.

## Organizer flow

1. Create a session with a name and date.
2. Add player display names and court labels. Entries can be deactivated without breaking past assignments.
3. Add a queued match by choosing a court and four distinct players, or fill the next free courts with Smart Rotation. The selection order defines the two sides.
4. Start or resume the queue entry through the existing setup and scorekeeping screens. The planned match UUID connects it to its synced match journal.
5. Return to the session board to see match state and ranked standings, then complete or reopen the session.

## Persistence and privacy

The migration creates owner-scoped session, player, court, and queue tables with RLS, validation, and indexes. Player and court records use stable IDs. Match results are derived from completed account-owned matches rather than copied into a second score store. Session rows do not use guest-match expiry. Account deletion cascades through session-owned data.

Player names are personal data. They are private to the organizer's account in the session board and are not added to the Live Viewer projection. Names are copied into the match definition for the existing account match journal. Review the privacy notice and actual deployed behavior before public rollout.

## Implementation status

- [x] Create sessions and list the owner's sessions.
- [x] Add, deactivate, and reactivate players and courts.
- [x] Manually assign four distinct players to a court and queue the match.
- [x] Launch the existing setup/scoring flow with the roster names and stable match ID.
- [x] Resume started entries; attach match records after their first server sync.
- [x] Keep the one-click doubles round-robin generator as a compatibility path.
- [x] Plan the next free courts with equal-match fairness, availability, mixed-doubles constraints, pairing history, and skill-aware tie-breaks.
- [x] Persist session pairing mode and player gender, skill level, availability, and avoid-player preferences.
- [x] Add the avoid-player preference editor and explicit manual open-doubles fallback controls to the roster/queue UI.
- [x] Derive ranked standings with played/won/lost counts and win rate, excluding incomplete or not-yet-synced results.
- [x] Show a reviewable Smart Rotation proposal with selected-player match counts and tie-breaker metrics.
- [x] Reject a Smart Rotation proposal when the session data changes before confirmation.
- [x] Complete, reopen, or delete a session without deleting its match journals.
- [x] Add account-only RLS and account-deletion cascade in the migration.
- [x] Keep the existing Club Sessions migration applied before deploying the session board.
- [x] Apply `20261023150000_club_session_smart_rotation.sql` in Supabase Preview before deploying Smart Rotation.
- [ ] Verify RLS isolation, deletion, sync recovery, accessibility, mobile court-side use, and pending/error states in Preview. Follow the [Smart Rotation pilot checklist](qa-smart-rotation-pilot.md).
- [ ] Run a small club pilot and have the owner/legal reviewer approve the privacy notice before production.

## Follow-up decisions

- Confirm with pilot clubs whether to add more rotation policies, bracket formats, or additional sports.
- Consider multi-organizer permissions only if one-owner operation proves limiting.
- Keep brackets, public event pages, player accounts, and cross-session player statistics out of scope until a pilot establishes demand.
