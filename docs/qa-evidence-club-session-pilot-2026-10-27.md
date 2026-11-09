# QA evidence: Club Session pilot and release hardening

**Date:** 2026-10-27
**Environment:** local checkout `/Users/ptnep/Ngoding/skor-lapangan`, branch `release/v1-preview`
**Status:** Local hardening and Preview deployment evidence only. Authenticated Preview verification, the organizer pilot, privacy/legal review, and owner approval remain open.

## Scope

This run prepares the current private, organizer-led Club Session MVP for a controlled Preview pilot. It does not add RSVP, waitlist, public discovery, payment, tournament brackets, new scoring rules, or new Live Viewer payloads.

The intended pilot matrix is:

- Badminton doubles: five players on one court and eight players across two courts.
- Pickleball doubles: open pairing and an uneven Mixed roster requiring explicit open fallback.
- Table tennis singles: two-player ten-minute timed rounds with persisted countdown.
- Squash singles: two-player queue and Match handoff.

## Baseline and release freeze

| Item                  | Recorded value                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate base commit | `4f2f68d079eaaa2bb5e5dc1851e0af4758253415` (`feat: add result sharing and history insights`)                                                                                                       |
| Working tree          | Not clean; only the hardening test/evidence changes listed in this run are present.                                                                                                                |
| Migration count       | 35 files in `supabase/migrations/`                                                                                                                                                                 |
| Migration head        | `20261026130000_history_filters_and_statistics.sql`                                                                                                                                                |
| Preview URL           | [`skor-lapangan-5p58js0ht-hanifaliffudins-projects.vercel.app`](https://skor-lapangan-5p58js0ht-hanifaliffudins-projects.vercel.app), deployment `dpl_GD4SnGptQ9hbw2PEA1qhZmjxhAyE`, status Ready. |
| Browser/device        | Local Playwright Chrome headless plus an existing Chrome session; no real-device evidence captured.                                                                                                |

The pilot freeze keeps the existing roster/court management, profile-aware queue, Smart Rotation, manual assignment, Match handoff, and synced standings. It does not introduce RSVP, waitlist, public discovery, payment, tournament brackets, or public Live Viewer links.

## Local automated checks

- [x] `pnpm test` passed: 71 scoring-core tests and 221 web tests.
- [x] `pnpm typecheck` passed.
- [x] `pnpm build` passed. Vite retained its existing informational static/dynamic import warning; the PWA service worker was generated.
- [x] `pnpm format:check` passed.
- [x] `pnpm test:e2e` passed with one worker: 12 passing tests and 3 intentional skips. The E2E config now serializes browser contexts because parallel anonymous-auth requests hit the Preview rate limit and made local smoke results nondeterministic.
- [x] `pnpm audit --prod` passed: `No known vulnerabilities found`.

The E2E smoke setup now clears both legacy browser storage and the IndexedDB Match store before each scenario so durable Match records cannot leak between tests. The Tennis smoke flow was reproduced standalone and passed after this isolation change.

## Disposable database checks

- [x] `supabase db reset --no-seed` completed against the local disposable database; all 35 repository migrations applied in filename order.
- [x] `supabase test db` passed: 18 pgTAP files and 187 tests.
- [ ] Supabase migration history was compared with the Preview project. The linked-project CLI check did not return within 90 seconds, so remote Preview history remains unverified.
- [ ] Preview RLS, write guards, queue RPC, time-zone validation, deletion cascade, and cross-account isolation remain to be run by an authorized operator.

## Manual Preview gates

- [ ] OAuth login/logout and provider-neutral account gate.
- [ ] Create session, roster/court lifecycle, manual queue, Smart Rotation, stale proposal rejection, and Match handoff.
- [ ] Account deletion and preservation of Match journals after session deletion.
- [ ] Mobile portrait/tablet pass, keyboard-only pass, visible focus, announcements, and 44px touch targets.
- [ ] English and Indonesian pass for setup, queue, proposal, errors, and offline states.
- [x] Local production bundle scan found no credential-bearing service-role, private-key, or client-secret pattern.
- [ ] Preview CORS/environment verification and final browser-bundle review remain open.

## Follow-up evidence — 2026-10-28

- Production dependency audit passed with no known vulnerabilities.
- The disposable Supabase database reset successfully from all repository migrations.
- The full disposable pgTAP suite passed: 18 files and 187 tests.
- The local production bundle scan found no credential-bearing service-role, private-key, or client-secret pattern. Generic Supabase client-library identifiers were not treated as secrets.
- The remote Preview migration-history check did not return within 90 seconds and remains an explicit release blocker until an authorized operator verifies it.

## Preview deployment evidence — 2026-10-28

- A new Preview deployment was created from the current hardening working tree and reached `Ready`.
- Vercel Preview environment variable names are present for `VITE_AUTH_PROVIDERS`, `VITE_SITE_ORIGIN`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_URL`; values were not copied into this evidence.
- Vercel CLI protection-bypass requests returned HTTP 200 for `/`, `/rules`, `/sessions`, and `/id/`. The responses included the expected security headers and `X-Robots-Tag: noindex` for Preview.
- The standalone Playwright browser smoke could not reach the app because the deployment presents the Vercel SSO login page to that unauthenticated browser context; the two failed Community Rules assertions did not execute against the application.
- An existing Chrome session did reach the app and verified anonymously: Club Sessions owner-only state with Google/GitHub sign-in actions, the English Community Rules directory and filters, the sign-in gate for `/rules/new`, the unavailable Live Viewer state with a home action, and the Indonesian Club Sessions copy after switching language.
- Supabase Authentication URL Configuration was updated with both the exact Preview root (`https://skor-lapangan-5p58js0ht-hanifaliffudins-projects.vercel.app/`) and its path pattern (`/**`). The dashboard confirmed both entries were saved.
- Supabase Sign In / Providers shows Google enabled, with the Supabase callback URL `https://esuizdlgzcmsundzuhbq.supabase.co/auth/v1/callback` configured for the provider. A read-only Google Cloud review found the same callback URI on the matching web OAuth client; its Authorized JavaScript origins currently contain localhost and the production origin, but not this Preview origin. The Preview origin is not required for the server callback URI itself, but remains a compatibility hardening candidate pending explicit permission to edit the OAuth client allowlist.
- Supabase Site URL remains the production alias. It was not changed to Preview because that setting is global and could redirect or disrupt Production authentication.
- The Preview OAuth launch carried the exact Preview origin as `redirect_to`, but the callback still ended at the Production alias instead of returning to Preview. The authenticated Preview gate therefore remains open for investigation of browser/provider state handling; no Production setting was changed.
- Supabase Auth Logs recorded `400: OAuth state has expired` from the Auth API for the failed callback. This confirms the current blocker is OAuth state lifecycle, not a missing Preview route entry. Repeated retries were stopped to avoid creating unnecessary account/session noise.
- After the redirect entries were saved, the Preview and Supabase project-domain site data were cleared through the visible Chrome controls and a fresh Google OAuth flow was started. The user selected an account, but the resulting browser tab again landed on `https://skor-lapangan-hanifaliffudins-projects.vercel.app/#` (Production alias). This is a reproducible redirect blocker; the Production origin was not inspected or mutated because the pilot authorization is Preview-only.
- On 2026-10-29, the Preview origin was added and saved to the matching Google OAuth client's Authorized JavaScript origins. A fresh Preview login was then started with the exact Preview `redirect_to`; after the user selected an account, Supabase again returned `bad_oauth_state` / `OAuth state has expired` and redirected to the Production alias. The Google allowlist change did not resolve the blocker, so no further OAuth retries were performed.
- Do not disable Preview protection broadly for the pilot. Retry authenticated Preview only after the OAuth state issue is resolved or a separate disposable provider flow is available.

## Follow-up evidence — 2026-10-29

- The matching Google OAuth client's Authorized JavaScript origins now include the exact Preview origin without a trailing slash. The Supabase Auth URL Configuration also includes the exact Preview origin without a trailing slash, in addition to the root-with-slash and path-pattern entries.
- A fresh Google OAuth flow launched from the Preview app returned to the exact Preview `/sessions` route after account selection. The authenticated account menu and Club Sessions create form were visible; the callback no longer returned to the Production alias. The OAuth Preview callback blocker is therefore resolved for this tested Google flow.
- The authenticated Preview smoke created `QA OAuth Badminton 2026-10-29` as a Badminton open-doubles session, then persisted four synthetic QA players and one synthetic QA court.
- Smart Rotation produced an explainable proposal for `QA Player 1 + QA Player 4 vs QA Player 2 + QA Player 3` with zero match-history gap, zero avoid-preference penalty, zero repeated-pair penalty, and zero skill gap. Confirming it created `MATCH 1` in the queue without a duplicate assignment.
- Match handoff opened the planned Match with the same four assigned players. The Match was completed with a 2–0 result using the score-correction seam; returning to the session showed `Match saved`, and standings changed to one win for Team A players and one loss for Team B players only after completion.
- A separate Pickleball open-doubles smoke persisted five players and one court. Smart Rotation selected four players and created a normal queue entry, leaving one player out of the first round as expected.
- A Pickleball Mixed session with four unspecified-gender players correctly blocked normal Mixed rotation, offered an explicit open fallback, and displayed the proposal as `OPEN FALLBACK`. Confirming the fallback failed twice on Preview with `This change was not saved. Please try again.` The local trigger diagnosis found that the current historical guard rejected every `is_open_fallback` row because its `elsif` branch ran for Mixed fallback rows.
- The forward-only local fix is `supabase/migrations/20261029130000_allow_mixed_open_fallback.sql`, with positive pgTAP regression tests for Mixed fallback, two-player Table tennis queueing, and cross-account update/delete isolation. The same migration also corrects the historical unique-player check so nullable singles slots do not reject a valid two-player assignment. After the fix, the disposable suite passed 18 files / 195 tests. The migration has not been applied to the remote project because the available Supabase project is the `main`/Production project and this pilot is Preview-only; the Preview Mixed fallback and singles queue scenarios remain release blockers until an authorized Preview database target is available and verified.
- The Table tennis Preview session rendered the intended singles/10-minute profile and persisted two players plus one table. Smart Rotation produced a two-player proposal with no duplicate assignment, but confirmation failed with `This change was not saved. Please try again.`
- The authenticated Preview page still shows `Sign-in succeeded, but guest matches are not synced yet: Failed to send a request to the Edge Function`. This is a separate guest-match transfer/sync defect: it did not prevent the Club Session create, roster, court, queue, handoff, or completed-standings smoke, but it keeps the account-foundation and release sign-off open.
- A source-level review narrowed the guest-transfer request failure to the Preview Edge Function boundary: the shared CORS helper allows Production and local origins by default, while a Vercel Preview origin requires an exact `ALLOWED_ORIGINS` entry and both account functions must be deployed to the same Supabase target. The available Supabase account exposes only one project and no separate Preview target, so the function deployment, runtime secrets, and authenticated preflight/POST response cannot be verified safely from this run.
- Added `scripts/check-edge-functions.mjs` and the `pnpm check:edge-functions` command as a redacted operator smoke check. A local mock server verified the CORS preflight and authenticated response-shape paths; the no-token path stops before POST. It was not run against any remote project.
- This smoke used synthetic roster data in Preview only. No Production page was inspected or mutated, and no public Live Viewer link was created.

## Preview target and release-hardening evidence — 2026-11-02

- A dedicated Supabase Preview project is now available: ref `jztetcumyrmaaupbmpdc`, region `eu-west-1`. Production project `main` (`esuizdlgzcmsundzuhbq`) was not changed.
- All 36 repository migrations were applied to Preview in filename order through the SQL Editor. The Preview metadata table was initialized and verified with 36 rows, first version `20261008160000`, and last version `20261029130000`. Local disposable verification remains green at 18 pgTAP files / 195 tests.
- Edge Functions `delete-account` and `transfer-guest-matches` are `ACTIVE` on Preview. The CORS preflight from the final Vercel Preview returned HTTP 200 with the exact allowed origin. A POST without a bearer token now returns HTTP 401 with the same CORS headers after the auth-guard hardening in `supabase/functions/transfer-guest-matches/index.ts`.
- The final Vercel Preview deployment is [`skor-lapangan-g51za6m4t-hanifaliffudins-projects.vercel.app`](https://skor-lapangan-g51za6m4t-hanifaliffudins-projects.vercel.app), deployment `dpl_6Pa5J2NNB8Ht7hAM4Q5NLEEsxUQM`, status Ready. `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SITE_ORIGIN` were updated only in the Vercel Preview environment.
- Supabase Auth Preview has anonymous sign-ins enabled. The final Preview Site URL and redirect URL are configured. The final app loaded without the anonymous-sync warning; a synthetic `QA A1`–`QA B2` Guest Badminton match reached `Score saved`. Club Sessions correctly remains private and presents the sign-in gate to an anonymous visitor.
- Google is still disabled in the new Preview project. The Supabase callback URL is visible and correct, but configuring the provider requires entering an OAuth client secret. Authenticated Club Session creation, RLS isolation through the browser, account deletion, and the full authenticated Edge Function transfer smoke therefore remain open. No OAuth secret was copied or exposed by this run.
- Current release decision: **NO-GO for the authenticated Club Session pilot** until a durable Preview account can complete the four-profile smoke and the remaining privacy, mobile, keyboard, deletion, and cross-account evidence is recorded. No public Live Viewer link was created.

## Organizer pilot record

Complete this section with a disposable or consented Preview account. Do not add public Live Viewer links to pilot evidence.

| Observation                                                | Result / note |
| ---------------------------------------------------------- | ------------- |
| Organizer, date, browser, device                           |               |
| Badminton: five-player single-court rotation               |               |
| Badminton: two-court rotation with one occupied court      |               |
| Badminton: late/resting/unavailable exclusions             |               |
| Pickleball: open pairing                                   |               |
| Pickleball: Mixed fallback confirmation                    |               |
| Table tennis: ten-minute countdown after reload/navigation |               |
| Squash: two-player queue and handoff                       |               |
| Manual corrections                                         |               |
| Rejected proposals                                         |               |
| Stale proposals recovered                                  |               |
| Sync or auth failures                                      |               |
| Mobile/keyboard/accessibility issues                       |               |
| Organizer could explain each selection                     |               |
| Organizer still needed paper, spreadsheet, or chat         |               |
| Privacy or metadata concern                                |               |
| Repeat-use intent                                          |               |

## Go/no-go

Do not promote to Production if any of these occur:

- roster/name data is visible to another account or Live Viewer;
- duplicate player, court, or queue assignment is accepted;
- Mixed open fallback cannot be persisted after the explicit fallback confirmation;
- Match handoff loses the planned Match identity or journal;
- incomplete or pending-sync results appear in standings;
- scoring state is corrupted;
- an applied migration is incompatible with the candidate frontend.

Production promotion additionally requires successful Preview verification, completed organizer evidence, privacy notice review, owner/legal approval, a known-good rollback deployment, and an incident contact.
