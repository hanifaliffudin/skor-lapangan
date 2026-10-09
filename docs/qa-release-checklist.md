# QA and release checklist

Use this checklist before a public release and again after a scoring, sync, or database change. Record the version, environment, browser/device, tester, date, and result in the release notes or issue tracker. Do not mark a check complete without evidence.

## Automated checks

- [ ] `pnpm test` passes. This builds the scoring package and runs the scoring-core and web tests.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm exec prettier --check .` passes.
- [ ] Review `supabase/tests/match_rls.test.sql`, `supabase/tests/live_viewer_rls.test.sql`, `supabase/tests/community_rules_rls.test.sql`, and `supabase/tests/release_guardrails.test.sql` in a test database. Never run test setup against production data.
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
- [ ] Verify guest expiry refreshes on accepted activity but never exceeds 24 hours from creation. Check expired records become inaccessible immediately and the hourly cleanup physically removes them and their events while the Supabase project is active.
- [ ] Record that Supabase Free may pause a low-activity project and delay physical cleanup; after any resume, inspect Cron history and remove remaining expired rows through the authorized cleanup procedure.
- [ ] Link a guest to Google and confirm still-valid guest matches are claimed without changing their IDs.

## Live Viewer

- [ ] Create a link from a guest match and open it in a private browser window without signing in.
- [ ] Confirm the viewer shows score and court positions without player-entered names, editing controls, or account identifiers.
- [ ] Score a point on the owner view and confirm the viewer updates. Disconnect the viewer and verify the stale/offline state is clear.
- [ ] Revoke the link and confirm later reads fail. Verify an expired link also fails.
- [ ] Confirm the viewer expires within 12 hours, no later than match data, and that reads do not refresh expiry. Treat the raw link as a bearer secret.

## Accounts and Community Rules

- [ ] Read the public Community Rules directory without signing in.
- [ ] Sign in with Google. Create a rule, share its URL and QR code, edit it, and confirm the version increments.
- [ ] Confirm a new match can use the published version and an already-started match keeps its selected local snapshot.
- [ ] Unpublish the rule. Confirm it disappears from public discovery and cannot be selected for a new match.
- [ ] Submit a report as a signed-in user and as a guest, with and without optional contact email. Confirm all six reasons are accepted and report data is not readable by public clients.
- [ ] Submit a fourth report in one hour from the same anonymous session; verify a clear wait-and-retry message. Confirm reports do not automatically hide a rule.
- [ ] Review one report in Supabase SQL Editor and record a dismissal or unpublish decision using the runbook. Confirm the queue stays private and status/resolution fields update.
- [ ] Apply `20261009120000_safe_community_rule_reads.sql`, deploy the frontend that uses those read functions, then apply `20261009130000_revoke_community_rule_table_reads.sql`. Confirm public rules and versions still load, direct reads of both underlying tables are denied, and no response contains `author_id` or `created_by`.

## Mobile, accessibility, and states

- [ ] Test a narrow phone viewport and a larger phone viewport. Confirm no horizontal overflow, clipped content, or controls below a 44 px tap target.
- [ ] Check screen visibility with a device placed at a realistic court-side distance and brightness.
- [ ] Navigate the setup, match controls, dialogs, sharing, and reports with keyboard only. Confirm visible focus and Escape behavior for dialogs.
- [ ] Verify loading, empty, offline, expired, unavailable, and error states explain what happened and what the user can do next.
- [ ] Check English default and Indonesian copy for truncation or layout changes.

## Public-launch blockers to resolve

- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to Vercel Preview if Preview deployments will be used for server-backed smoke tests. Use only the public publishable key, never a service-role key.
- [ ] Set and verify the Supabase Auth anonymous sign-in rate limit (initial recommendation: 10 per IP per hour); keep CAPTCHA disabled initially and enable it only if abuse appears.
- [ ] Confirm new matches expose only Casual mode and old saved Referee matches remain readable.
- [ ] Apply the release-guardrail migration, verify the hourly `purge-expired-guest-data` Cron job succeeds, and confirm the job removes expired rows.
- [ ] Publish the approved privacy notice, terms, and Community Rules policy with real owner and contact details.
- [ ] Publish the report review path and operational contact, and decide the account-deletion request channel before public launch.
- [ ] Verify the staged Community Rules read and revoke migrations are applied in the intended order before production release.
- [ ] Run the production smoke test after Vercel deployment and after the Supabase migrations/configuration are complete.
