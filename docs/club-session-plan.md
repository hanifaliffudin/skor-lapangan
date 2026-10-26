# Club Sessions and Tournament Mode

Status: Smart Rotation MVP and the first sport-aware Play Profiles are implemented in code, and the all-sport and Play Profile migrations are applied in Supabase Preview. All six sports are selectable; squash uses singles and table tennis uses ten-minute singles rounds with a persisted countdown, while the queue, rotation planner, persistence, and scoring handoff support two-player entries. Authenticated Preview validation, pilot, and owner/legal approval remain open.

## Product hypothesis

An organizer running casual play across several courts or tables needs a lightweight place to manage the roster, assignments, rotation, and results without replacing the existing scorekeeper. Validate the workflow with club organizers before expanding its scope.

## Community mabar requirement

Research across Badminton, Pickleball, Tennis, Padel, Table tennis, Squash, and Indonesian community listings shows that “mabar” is not one universal doubles queue. Some communities use a player queue, some use timed court rotation, some use short rounds, and some use open matches that fill four spots. The recurring complaints are long waits, unclear rotation rules, court hogging, no-shows, level mismatch, and organizers calculating everything in chat.

The all-sport Club Session contract therefore needs a sport-aware **Play Profile** before it is treated as community-ready. A profile defines the format, participants per court or table, rotation unit, turn-taking rule, capacity, skill mode, check-in lifecycle, and fairness explanation. The detailed evidence and prioritized backlog live in [the mabar requirements research](research/club-session-mabar-requirements.md).

The current implementation covers the first profile slice: format, participants per court/table, rotation unit, and a courtside countdown for timed rounds. RSVP, waitlist, check-in, capacity, turn-taking policy, and public discovery/payment are intentionally still out of scope.

## MVP decisions

- Start with organizer-led open play across all six supported sports, using a sport-aware Play Profile and the selected sport's Official Rules.
- Require one durable account linked through an enabled OAuth provider to own and manage each private session. Players do not need accounts.
- Keep manual queue editing, and offer Smart Rotation for the next free courts. Rotation prioritizes equal match counts, then wait time, pairing variety, avoid preferences, and optional skill balance. Do not add tournament brackets yet.
- Show ranked standings with played, won, lost, and win-rate values. Rank by wins, then win rate, then matches played, with roster order as the stable final tie-break.
- Count only completed matches that have synced to the server. Keep the existing match journal as the source of truth.
- Do not publish session rosters, session results, or aggregate scoreboards. Existing Live Viewer links remain scoped to individual matches and do not expose player names.
- A session stays stored until its owner deletes it or deletes their account. Deleting a session removes its roster, courts, and links, but leaves match journals in account history.

## Organizer flow

1. Create a session with a name and date.
2. Add player display names and court labels. Entries can be deactivated without breaking past assignments.
3. Add a queued match by choosing a court and the number of players required by the Play Profile, or fill the next free courts with Smart Rotation. Doubles uses four players; squash and the table-tennis short-round profile use two.
4. Start or resume the queue entry through the existing setup and scorekeeping screens. The planned match UUID connects it to its synced match journal.
5. Return to the session board to see match state and ranked standings, then complete or reopen the session.

## Persistence and privacy

The migration creates owner-scoped session, player, court, and queue tables with RLS, validation, and indexes. Player and court records use stable IDs. Match results are derived from completed account-owned matches rather than copied into a second score store. Session rows do not use guest-match expiry. Account deletion cascades through session-owned data.

Player names are personal data. They are private to the organizer's account in the session board and are not added to the Live Viewer projection. Names are copied into the match definition for the existing account match journal. Review the privacy notice and actual deployed behavior before public rollout.

## Implementation status

- [x] Create sessions and list the owner's sessions.
- [x] Create sessions for all six supported sports and carry the selected sport into scoring setup.
- [x] Define and persist the first Play Profiles per sport: doubles for badminton, pickleball, tennis, and padel; squash singles; and ten-minute table-tennis singles rounds.
- [x] Replace the fixed four-player doubles queue with a profile-aware participant and rotation model for the first singles slice.
- [x] Show the persisted countdown for the table-tennis short-round profile while its Match is active.
- [ ] Add RSVP, waitlist, check-in, late, absent, and replacement states before opening sessions to public discovery.
- [ ] Show queue order, wait time, active court/table, and the reason for each Smart Rotation choice.
- [x] Add, deactivate, and reactivate players and courts.
- [x] Manually assign the profile-required distinct players to a court and queue the match.
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
- [x] Apply `20261024100000_club_session_pickleball.sql`, `20261024110000_club_session_all_sports.sql`, and `20261024120000_club_session_play_profiles.sql` in Supabase Preview before deploying sport-aware Club Sessions.
- [ ] Verify RLS isolation, deletion, sync recovery, accessibility, mobile court-side use, and pending/error states in Preview. Follow the [Smart Rotation pilot checklist](qa-smart-rotation-pilot.md).
- [ ] Run a small club pilot and have the owner/legal reviewer approve the privacy notice before production.

## Follow-up decisions

- Confirm with pilot clubs which Play Profiles and rotation policies fit local communities, then consider bracket formats or sports beyond the six currently supported.
- Consider multi-organizer permissions only if one-owner operation proves limiting.
- Keep brackets, public event pages, player accounts, and cross-session player statistics out of scope until a pilot establishes demand.
