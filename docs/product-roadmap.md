# Product roadmap

This roadmap records the planned public releases for Skor Lapangan. It has no release dates. Treat each release as planned until its exit checks pass. Detailed V1.0 requirements live in the [implementation specification](v1-implementation-spec.md).

## Release strategy

Launch V1.0 with Badminton and Pickleball singles and doubles. Use the first public release to learn whether scoring, correction, synchronization, and the live display work during real games. The repository may contain preview implementations for additional sports and account features before they are promoted publicly. Each additional sport still has its own rules, database, regression, and mobile release gate.

Keep the product mobile-first and English by default, with Indonesian available. Keep operating costs at zero or close to it. Do not add paid infrastructure without an explicit decision.

## Release sequence

| Release | Goal                                                  | Scope                                                                                                                                                                                                                                                                                                                                                                | Exit check                                                                                                                                                                                                        |
| ------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.0    | Public MVP for Badminton and Pickleball               | Singles and doubles, guest matches, score controls, Live Viewer, Official Rules, and local guest custom rules. No Google account history or Community Rules.                                                                                                                                                                                                         | V1.0 launch checks below pass                                                                                                                                                                                     |
| V1.1    | Account foundation and multi-sport preview            | Harden scoring and sync, release Google sign-in, guest claiming, permanent match history, account controls, and in-app deletion through local → Vercel Preview → production gates. The preview code may also expose Tennis, Padel, Table tennis, and Squash before their public promotion gates pass. Keep Community Rules behind its own moderation and legal gate. | Critical scoring and sync defects are resolved, account deletion and security checks pass, Preview smoke tests pass, and production is promoted only after the account foundation gate passes.                    |
| V1.2    | Public Tennis promotion                               | Promote Tennis singles, standard doubles, and mixed doubles from preview after its own rule, regression, mobile, and Supabase migration checks pass.                                                                                                                                                                                                                 | ITF 2026 formats, service/receiver rotation, corrections, history, sync, Live Viewer privacy, and mobile play-through checks pass. Apply the Tennis migration before public promotion.                            |
| V1.3    | Public Padel promotion                                | Promote FIP doubles and mixed doubles plus the labeled local club-singles variant from preview after its own rule, regression, mobile, and Supabase migration checks pass.                                                                                                                                                                                           | FIP 2026 formats, court display, service/receiver rotation, mixed receiver eligibility, corrections, sync, Live Viewer privacy, and mobile checks pass. Apply the Padel migration before public promotion.        |
| V1.4    | Public Table tennis promotion                         | Promote ITTF singles and doubles from preview after its rule, regression, mobile, and Supabase migration checks pass.                                                                                                                                                                                                                                                | ITTF 2022 game scoring, serve/receiver rotation, deciding-game changes, corrections, sync, history, Live Viewer privacy, and mobile checks pass. Apply the Table tennis migration before public promotion.        |
| V1.5    | Public Squash promotion                               | Promote WSF singles and doubles from preview with manual rally scoring, service-box tracking, and no mixed doubles after its rule, regression, mobile, and Supabase migration checks pass.                                                                                                                                                                           | WSF singles/doubles scoring, server/receiver order, service-box events, corrections, sync, history, Live Viewer privacy, and mobile play-through checks pass. Apply the Squash migration before public promotion. |
| V2.0    | Reassess product scope after the first sport releases | No feature set is committed yet. Use V1.x feedback to decide whether broader sport coverage or other product changes are warranted.                                                                                                                                                                                                                                  | A separate product decision defines the scope and reason for a major release                                                                                                                                      |

The sequence after V1.1 is a proposal, not a promise. Preview availability is not public release approval. Do not wait for six sports before launching V1.0. Promote one sport at a time, and change the order when player feedback supports a different choice.

## Club Sessions and tournament-lite

Status: Badminton doubles MVP is implemented and the Smart Rotation migration is applied in Supabase Preview. Rollout still needs authenticated Preview validation, a club pilot, and the privacy/owner release gate.

A club organizer can create a private session, manage its player list and courts, manually queue matches, and follow played/won/lost records in roster order. The first version reuses the existing match setup and scoring flow. Automatic rotations and tournament brackets remain out of scope until the club workflow has been validated.

See the [Club Sessions and Tournament Mode plan](club-session-plan.md) for MVP scope, implementation status, and rollout checks.

## Current implementation snapshot

The current preview implementation is ahead of the public release sequence:

- Google account sign-in, guest-match transfer, account history, sign out, and in-app deletion are present in the application code.
- Tennis, Padel, Table tennis, and Squash are available in the preview setup, but their public promotion still depends on the release gates in V1.2–V1.5.
- This snapshot is not a public-release sign-off. Backend migrations and Edge Functions, OAuth provider configuration, Preview smoke tests, database tests, mobile checks, privacy/legal review, and owner approval must still pass before production promotion.

## V1.0 public MVP

### Included

- Badminton singles and doubles using the Official Rules sources recorded in [rules sources](rules-sources.md).
- Pickleball singles and doubles using the Official Rules sources recorded in [rules sources](rules-sources.md). Singles supports side-out and rally scoring.
- Match setup, team and player positions, point entry, automatic service and position changes, undo, redo, and one-event score override.
- Guest play without Google sign-in. Generate match and event UUIDs in the browser, save locally first, and sync idempotently when the server is available.
- Guest match continuity for up to 12 hours after the last accepted server activity, capped at 24 hours from creation. Expired guest data and Live Viewer links stop being accessible immediately; an hourly database cleanup physically removes expired game data.
- Owner-created Live Viewer links. Viewers do not need an account and can see only the score and court positions. Owners can revoke links, and links expire within 12 hours and no later than the match data.
- Official Rules stay locked and follow federation sources. Guest custom rules apply only to the current match.
- Guest-created custom rules apply only to that guest's current match. They stay in the browser, are not published or synced, and are discarded when the match ends.
- Anonymous sign-in and server actions have rate limits. CAPTCHA is a fallback if real abuse appears, not a launch prerequisite.
- New matches use the single Casual workflow. Referee is hidden until it has meaningfully different behavior.

### Not included

- Sports other than Badminton, Pickleball, Tennis, Padel, Table tennis, and Squash.
- Public Community Rules, including publishing, sharing, reports, and moderation.
- Arbitrary rule scripting or complex editing of a match's event history.
- Server storage or sharing of a guest's private custom rules.

### Launch checks

- Tests cover scoring and service rotation for both sports, including game changes, undo, redo, and score override behavior.
- Retrying a sync preserves match and event UUIDs and does not create duplicates. Offline recovery, 12-hour expiry, and single-tab control are verified.
- A Live Viewer works without sign-in, exposes only the intended score and court-position display, and stops working after revocation or expiry.
- New V1.0 matches can use only Official Rules or guest-only custom rules. Account foundation routes are introduced only through the staged rollout; Community Rules routes remain unavailable.
- Supabase row-level security and viewer access tests pass. The frontend contains no service-role secret.
- Mobile play-through confirms that scores and court positions are readable during play, controls are usable with touch, and no content overflows horizontally.
- Loading, empty, offline, and error states provide a clear status or next action.
- Set the Supabase Auth anonymous sign-in limit and verify the hourly expired-guest cleanup job before broad public access. Start without CAPTCHA and enable it if abuse appears.
- Keep Referee hidden until there is a clear player need and a distinct workflow to test.

## V1.1 feedback cycle

After V1.0 is used in real games, collect feedback on three areas:

1. Whether undo, redo, and score correction are understandable and recover mistakes safely.
2. Whether guest sync, reconnect, match resumption, and Live Viewer updates behave reliably across browsers and tabs.
3. Whether players can read the score, server, and court positions at a glance on a phone placed near the court.

Review actual reports and reproduce issues before prioritizing changes. Do not add paid analytics just to answer these questions. Fix critical scoring and sync problems before promoting the V1.1 account foundation. Tennis development proceeds in parallel; preview clients may exist, but public Tennis promotion waits for its own rules, regression, mobile, and migration checks to pass.

Before production account rollout, complete the account deletion process, publish a support and privacy contact, and pass local plus Preview smoke tests. Community Rules remain deferred until the separate policy, moderation, contact, and security gates pass.

## Account foundation rollout gate

- Google login starts OAuth for the account and transfers unexpired guest matches through the server-only transfer flow; `claim_guest_matches()` then runs once after OAuth for matches already owned by the account. Expired matches remain unavailable.
- `/history` lists the active account's matches in active and completed groups, ordered by `updated_at`; account journals can be hydrated on another browser or device, while active matches remain single-editor through an explicit control lease.
- `/account` provides the Google email, history link, sign out, and a second-confirmation permanent deletion flow.
- Account deletion removes owned matches, events, rules, versions, reports, viewer capabilities, local browser matches, and the Auth user through the server-only Edge Function.
- Verify English and Indonesian routes, loading/error/empty states, keyboard focus, mobile layout, RLS, and no service-role key in the browser bundle.
- Apply the account-deletion and guest-transfer migrations, deploy both server-only account Edge Functions, and promote in order: local → Vercel Preview → production. Do not promote if any account, security, privacy, or staging smoke test fails.

## Adding a sport

Before scheduling a sport release:

- Confirm demand from player feedback.
- Identify the relevant federation rules and their effective date. Record the source in `docs/rules-sources.md`.
- Define which formats are supported, such as singles or doubles, before implementation.
- Add rules-engine tests for scoring, service changes, positions, corrections, and match completion.
- Verify the court layout and score visibility on mobile.
- Keep the ruleset snapshot attached to each match so later rule updates do not rewrite match history.

### Table tennis release gate

- Use the ITTF Handbook 2022 as the source of truth. Support singles and standard doubles only; mixed doubles is out of scope.
- Verify 11-point games, win by two, best-of-three/best-of-five, two-point service rotation, one-point deuce rotation, doubles receiver/server rotation, and deciding-game changes at five points.
- Verify setup order selection, next-game confirmation, correction, undo/redo, match completion, local persistence, Supabase sanitization, and Live Viewer projection without player names.
- Keep expedite, let/fault tracking, officiating, and referee workflow out of scope until a separate product decision.

### Squash release gate

- Use World Squash Singles Rules 2025 and International Doubles Squash Rules 2022 as separate official snapshots. Support singles and doubles only; mixed doubles is out of scope.
- Verify singles PARS 11 win-by-two, doubles 11–10 completion, manual rally scoring, server hand-out, automatic service-box alternation, fixed doubles server order, and receiver mapping per game.
- Verify setup, service-box choice after hand-out, next-game order confirmation, correction, undo/redo, match completion, local persistence, Supabase sanitization, and Live Viewer projection without names.
- Keep let, stroke, fault, appeal, injury, referee call, and officiating workflows out of scope until a separate product decision.

### Tennis release gate

- Use the 2026 ITF Rules of Tennis as the source of truth. Support singles, standard doubles, and mixed doubles with announced best-of-3/5, advantage/no-ad games, tie-break/advantage sets, and 7- or 10-point final match tie-breaks by two.
- Verify service and receiver rotations, tie-break rotations, court-end changes, per-set doubles orders, and the mixed-doubles no-ad receiver rule.
- Verify corrections for the active game or tie-break, event-based undo/redo, local persistence, sync, history, and the privacy-limited Live Viewer.
- Complete mobile play-throughs for singles, doubles, and mixed doubles. Apply the Tennis Supabase migration before enabling Tennis clients.

### Padel release gate

- Use the 2026 FIP Rules of Padel for doubles and mixed doubles. Support Advantage, Star Point, and Golden Point games; standard and mini-sets; and a standard, advantage, or 7-/10-point deciding-set match tie-break by two.
- Label singles as a local club variant because FIP does not define singles. Use the 6 × 20 m singles court and identify its scoring as FIP-derived, not FIP-approved.
- Verify service and receiver orders, set-by-set order changes, tie-break rotations, court-end changes, and same-gender receiver eligibility at mixed-doubles deciding points.
- Verify active-game and tie-break corrections, event-based undo/redo, local persistence, sync, history, and privacy-limited Live Viewer behavior. Complete mobile play-throughs for singles, doubles, and mixed doubles. Apply the Padel migration before enabling Padel clients.

## Decisions to revisit

- The order and supported formats for sports after Badminton and Pickleball depend on feedback and verified rules, not a fixed calendar.
- Revisit Referee only if real users need a distinct officiating workflow.
