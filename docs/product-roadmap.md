# Product roadmap

This roadmap records the planned public releases for Skor Lapangan. It has no release dates. Treat each release as planned until its exit checks pass. Detailed V1.0 requirements live in the [implementation specification](v1-implementation-spec.md).

## Release strategy

Launch V1.0 with Badminton and Pickleball singles and doubles. Use the first public release to learn whether scoring, correction, synchronization, and the live display work during real games. Tennis and Padel development can run in parallel with V1.1 hardening, each with its own rules, database, regression, and mobile release gates. Release each sport separately so it has its own launch and feedback cycle.

Keep the product mobile-first and English by default, with Indonesian available. Keep operating costs at zero or close to it. Do not add paid infrastructure without an explicit decision.

## Release sequence

| Release | Goal                                                     | Scope                                                                                                                                                                                                                                                | Exit check                                                                                                                                                                                                                   |
| ------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.0    | Public MVP for Badminton and Pickleball                  | Singles and doubles, guest matches, score controls, Live Viewer, Official Rules, and local guest custom rules. No Google account history or Community Rules.                                                                                         | V1.0 launch checks below pass                                                                                                                                                                                                |
| V1.1    | Harden the core and develop Tennis and Padel in parallel | Fix issues found in V1.0 scoring, synchronization, and screen visibility. Continue Tennis and Padel implementation alongside core hardening. Add Google sign-in and Community Rules only after their foundation and moderation readiness gates pass. | Critical scoring and sync defects are resolved, real-game feedback is reviewed, and the independent Tennis and Padel launch gates below pass. Account and Community Rules gates also pass before those features are enabled. |
| V1.2    | Launch Tennis                                            | Enable Tennis singles, standard doubles, and mixed doubles after its own rule, regression, mobile, and Supabase migration checks pass.                                                                                                               | ITF 2026 formats, service/receiver rotation, corrections, history, sync, Live Viewer privacy, and mobile play-through checks pass. Apply the Tennis migration before enabling clients.                                       |
| V1.3    | Launch Padel                                             | Enable FIP doubles and mixed doubles plus the labeled local club-singles variant after its own rule, regression, mobile, and Supabase migration checks pass.                                                                                         | FIP 2026 formats, court display, service/receiver rotation, mixed receiver eligibility, corrections, sync, Live Viewer privacy, and mobile checks pass. Apply the Padel migration before enabling clients.                   |
| V1.4    | Add Squash or the next most requested sport              | Select one sport based on player requests and implementation readiness. Verify its federation rules before committing scope.                                                                                                                         | The sport passes the same rules, regression, and mobile checks as V1.3                                                                                                                                                       |
| V2.0    | Reassess product scope after the first sport releases    | No feature set is committed yet. Use V1.x feedback to decide whether broader sport coverage or other product changes are warranted.                                                                                                                  | A separate product decision defines the scope and reason for a major release                                                                                                                                                 |

The sequence after V1.1 is a proposal, not a promise. Do not wait for six sports before launching V1.0. Add one sport at a time, and change the order when player feedback supports a different choice.

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

- Sports other than Badminton and Pickleball.
- Google sign-in, persistent account match history, and guest-to-account claiming.
- Public Community Rules, including publishing, sharing, reports, and moderation.
- Arbitrary rule scripting or complex editing of a match's event history.
- Server storage or sharing of a guest's private custom rules.

### Launch checks

- Tests cover scoring and service rotation for both sports, including game changes, undo, redo, and score override behavior.
- Retrying a sync preserves match and event UUIDs and does not create duplicates. Offline recovery, 12-hour expiry, and single-tab control are verified.
- A Live Viewer works without sign-in, exposes only the intended score and court-position display, and stops working after revocation or expiry.
- New V1.0 matches can use only Official Rules or guest-only custom rules. Account history and Community Rules routes are unavailable.
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

Review actual reports and reproduce issues before prioritizing changes. Do not add paid analytics just to answer these questions. Fix critical scoring and sync problems before enabling the V1.1 account and Community Rules features. Tennis development proceeds in parallel; do not enable Tennis clients until its own rules, regression, mobile, and migration checks pass.

Before V1.1 account and Community Rules work begins, complete the account deletion process, publish a support and privacy contact, approve the Community Rules policy, and confirm that the operator can review reports against the documented response targets. If those conditions are not met, keep the features deferred.

## Adding a sport

Before scheduling a sport release:

- Confirm demand from player feedback.
- Identify the relevant federation rules and their effective date. Record the source in `docs/rules-sources.md`.
- Define which formats are supported, such as singles or doubles, before implementation.
- Add rules-engine tests for scoring, service changes, positions, corrections, and match completion.
- Verify the court layout and score visibility on mobile.
- Keep the ruleset snapshot attached to each match so later rule updates do not rewrite match history.

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
