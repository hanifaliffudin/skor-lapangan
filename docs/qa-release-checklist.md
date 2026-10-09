# QA and release checklist

Use this checklist before a public release and again after a scoring, sync, or database change. Record the version, environment, browser/device, tester, date, and result in the release notes or issue tracker. Do not mark a check complete without evidence.

## Automated checks

- [ ] `pnpm test` passes. This builds the scoring package and runs the scoring-core and web tests.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm exec prettier --check .` passes.
- [ ] Review `supabase/tests/match_rls.test.sql`, `supabase/tests/live_viewer_rls.test.sql`, and `supabase/tests/community_rules_rls.test.sql` in a test database. Never run test setup against production data.
- [ ] `git diff --check` passes and no secret key appears in the browser bundle or repository.

## Match setup and scoring

- [ ] Start a Badminton doubles match with Official Rules, set all four player names, and choose each of the four possible initial servers in separate test matches.
- [ ] Verify Badminton service court, server change, receiver positions, game completion, next-game opening server, and match completion against the current source in `docs/rules-sources.md`.
- [ ] Start a Pickleball doubles match with Official Rules. Verify the opening 0-0-2 server sequence, side-out transition, second server, court positions, game completion, and match completion.
- [ ] Repeat representative scoring cases with a Community Rule and guest custom rules. Confirm that each supported setting changes the engine result as expected.
- [ ] Confirm the court stays in the intended portrait orientation with a horizontal net and that score, service, and positions are readable at court-side viewing distance.

## Corrections and event history

- [ ] Award a point to each team and verify that the score, server, and positions update correctly.
- [ ] Undo a point, redo it, undo again, then continue scoring. Confirm the final state and event sequence remain consistent.
- [ ] Override a score to a valid pair of totals. Confirm the app records one override event and derives service and positions from the overridden state.
- [ ] Try an invalid or out-of-range correction and confirm the app rejects it with a clear message.
- [ ] Refresh the match and verify the same score and local ruleset snapshot return.

## Guest storage and synchronization

- [ ] Start and play a match without Supabase configured. Confirm local scoring remains available and server-backed actions explain their unavailable state.
- [ ] With Supabase configured, start a guest match and verify its client-generated match and event UUIDs reach the server.
- [ ] Interrupt the network during scoring, reconnect, and verify queued events sync with the original UUIDs and in order.
- [ ] Retry the same sync more than once. Confirm no duplicate match or event rows appear.
- [ ] Open the same match in two tabs. Confirm only one tab controls it and the other remains read-only until control is released.
- [ ] Verify a guest record becomes inaccessible after its 12-hour server expiry. Separately verify local expiry and document that physical server deletion depends on the cleanup schedule.
- [ ] Link a guest to Google and confirm still-valid guest matches are claimed without changing their IDs.

## Live Viewer

- [ ] Create a link from a guest match and open it in a private browser window without signing in.
- [ ] Confirm the viewer shows score and court positions without player-entered names, editing controls, or account identifiers.
- [ ] Score a point on the owner view and confirm the viewer updates. Disconnect the viewer and verify the stale/offline state is clear.
- [ ] Revoke the link and confirm later reads fail. Verify an expired link also fails.
- [ ] Confirm the viewer expires no later than the match data and that the raw link is treated as a bearer secret.

## Accounts and Community Rules

- [ ] Read the public Community Rules directory without signing in.
- [ ] Sign in with Google. Create a rule, share its URL and QR code, edit it, and confirm the version increments.
- [ ] Confirm a new match can use the published version and an already-started match keeps its selected local snapshot.
- [ ] Unpublish the rule. Confirm it disappears from public discovery and cannot be selected for a new match.
- [ ] Submit a report as a signed-in user and as a guest. Confirm the selected reason and details are stored without exposing reports to public readers.
- [ ] Verify report submission does not imply the reported rule was hidden. Confirm the owner review procedure exists before public launch.
- [ ] Apply `20261009120000_safe_community_rule_reads.sql`, deploy the frontend that uses those read functions, then apply `20261009130000_revoke_community_rule_table_reads.sql`. Confirm public rules and versions still load, direct reads of both underlying tables are denied, and no response contains `author_id` or `created_by`.

## Mobile, accessibility, and states

- [ ] Test a narrow phone viewport and a larger phone viewport. Confirm no horizontal overflow, clipped content, or controls below a 44 px tap target.
- [ ] Check screen visibility with a device placed at a realistic court-side distance and brightness.
- [ ] Navigate the setup, match controls, dialogs, sharing, and reports with keyboard only. Confirm visible focus and Escape behavior for dialogs.
- [ ] Verify loading, empty, offline, expired, unavailable, and error states explain what happened and what the user can do next.
- [ ] Check English default and Indonesian copy for truncation or layout changes.

## Public-launch blockers to resolve

- [ ] Choose and test bot-abuse protection for anonymous sign-in. CAPTCHA is currently disabled for local guest testing.
- [ ] Define distinct Casual and Referee behavior or remove the mode choice before describing them as different.
- [ ] Schedule trusted server-side cleanup for expired guest records, or explicitly accept the storage consequence and set an owner check cadence.
- [ ] Publish the approved privacy notice, terms, and Community Rules policy with real owner and contact details.
- [ ] Decide account deletion and a review path for Community Rule reports.
- [ ] Verify the staged Community Rules read and revoke migrations are applied in the intended order before production release.
- [ ] Run the production smoke test after Vercel deployment and after the Supabase migrations/configuration are complete.
