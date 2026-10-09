# Product roadmap

This roadmap records the planned public releases for Skor Lapangan. It has no release dates. Treat each release as planned until its exit checks pass. Detailed V1.0 requirements live in the [implementation specification](v1-implementation-spec.md).

## Release strategy

Launch V1.0 with Badminton and Pickleball doubles. Use the first public release to learn whether scoring, correction, synchronization, and the live display work during real games. Improve that foundation before adding sports. Release each later sport separately so it has its own launch and feedback cycle.

Keep the product mobile-first and English by default, with Indonesian available. Keep operating costs at zero or close to it. Do not add paid infrastructure without an explicit decision.

## Release sequence

| Release | Goal                                                  | Scope                                                                                                                                                                       | Exit check                                                                                                                         |
| ------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| V1.0    | Public MVP for doubles play                           | Badminton and Pickleball, guest matches, score controls, Live Viewer, Official Rules, and Community Rules                                                                   | V1.0 launch checks below pass                                                                                                      |
| V1.1    | Improve the core using real player feedback           | Fix issues in undo/redo, synchronization, and screen visibility. Resolve whether Casual and Referee should behave differently. Do not bundle a new sport into this release. | Critical scoring and sync defects are resolved, regression tests pass, and feedback from real games has been reviewed              |
| V1.2    | Add Tennis as the next sport candidate                | Implement only after the V1.1 foundation gate passes. Confirm the supported format and current federation rules before development.                                         | Tennis scoring, serve changes, court positions, corrections, and match completion have rules-based tests and a mobile play-through |
| V1.3    | Add Squash or the next most requested sport           | Select one sport based on player requests and implementation readiness. Verify its federation rules before committing scope.                                                | The sport passes the same rules, regression, and mobile checks as V1.2                                                             |
| V2.0    | Reassess product scope after the first sport releases | No feature set is committed yet. Use V1.x feedback to decide whether broader sport coverage or other product changes are warranted.                                         | A separate product decision defines the scope and reason for a major release                                                       |

The sequence after V1.1 is a proposal, not a promise. Do not wait for six sports before launching V1.0. Add one sport at a time, and change the order when player feedback supports a different choice.

## V1.0 public MVP

### Included

- Badminton doubles using the Official Rules source recorded in [rules sources](rules-sources.md).
- Pickleball doubles using the Official Rules source recorded in [rules sources](rules-sources.md).
- Match setup, team and player positions, point entry, automatic service and position changes, undo, redo, and one-event score override.
- Guest play without Google sign-in. Generate match and event UUIDs in the browser, save locally first, and sync idempotently when the server is available.
- Guest match continuity for up to 12 hours after the last accepted activity. Expired guest data and Live Viewer links must stop being accessible.
- Owner-created Live Viewer links. Viewers do not need an account and can see only the score and court positions. Owners can revoke links, and links expire no later than the match data.
- Optional Google sign-in for persistent match history and for creating and managing public Community Rules.
- Official Rules stay locked and follow federation sources. Community Rules are public, shareable by link or QR, versioned, marked unofficial, and do not require manual approval. Anyone can report them; creators can unpublish their own rules.
- Guest-created custom rules apply only to that guest's current match. They stay in the browser, are not published or synced, and are discarded when the match ends.

### Not included

- Sports other than Badminton and Pickleball.
- Singles formats unless a later release defines and validates them.
- Arbitrary rule scripting or complex editing of a match's event history.
- Server storage or sharing of a guest's private custom rules.

### Launch checks

- Tests cover scoring and service rotation for both sports, including game changes, undo, redo, and score override behavior.
- Retrying a sync preserves match and event UUIDs and does not create duplicates. Offline recovery, 12-hour expiry, and single-tab control are verified.
- A Live Viewer works without sign-in, exposes only the intended score and court-position display, and stops working after revocation or expiry.
- Official and Community Rules remain visibly distinct. Rule revisions do not change the rule snapshot of a match already in progress.
- Supabase row-level security and viewer access tests pass. The frontend contains no service-role secret.
- Mobile play-through confirms that scores and court positions are readable during play, controls are usable with touch, and no content overflows horizontally.
- Loading, empty, offline, and error states provide a clear status or next action.
- Choose a bot-abuse protection approach before broad public access. CAPTCHA is currently disabled for local guest testing and should not be treated as the final public setting.
- Define the actual behavior of Casual and Referee before presenting them as different modes. The current app stores and displays the selection, but the scoring controls behave the same. Either implement a meaningful distinction or ship one mode in V1.0.

## V1.1 feedback cycle

After V1.0 is used in real games, collect feedback on three areas:

1. Whether undo, redo, and score correction are understandable and recover mistakes safely.
2. Whether guest sync, reconnect, match resumption, and Live Viewer updates behave reliably across browsers and tabs.
3. Whether players can read the score, server, and court positions at a glance on a phone placed near the court.

Review actual reports and reproduce issues before prioritizing changes. Do not add paid analytics just to answer these questions. Keep V1.1 focused on problems found in use, and leave a new sport for a separate release.

## Adding a sport

Before scheduling a sport release:

- Confirm demand from player feedback.
- Identify the relevant federation rules and their effective date. Record the source in `docs/rules-sources.md`.
- Define which formats are supported, such as singles or doubles, before implementation.
- Add rules-engine tests for scoring, service changes, positions, corrections, and match completion.
- Verify the court layout and score visibility on mobile.
- Keep the ruleset snapshot attached to each match so later rule updates do not rewrite match history.

## Decisions to revisit

- The Casual and Referee modes need a product definition before V1.0 can claim different workflows.
- Bot protection must be chosen before broad public access while anonymous sign-in is enabled.
- The order and supported formats for sports after Badminton and Pickleball depend on feedback and verified rules, not a fixed calendar.
