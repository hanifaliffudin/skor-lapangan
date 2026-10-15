# QA and release checklist

Use this checklist before a public release and again after a scoring, sync, or database change. Record the version, environment, browser/device, tester, date, and result in the release notes or issue tracker. Do not mark a check complete without evidence.

The latest engineering evidence run from 2026-10-15 is recorded in [qa-evidence-v1.0-2026-10-15.md](qa-evidence-v1.0-2026-10-15.md). The earlier runs remain available in [qa-evidence-v1.0-2026-10-13.md](qa-evidence-v1.0-2026-10-13.md) and [qa-evidence-v1.0-2026-10-09.md](qa-evidence-v1.0-2026-10-09.md). None is a production release sign-off; disposable database tests, real-device checks, legal review, and owner approval remain open even though the production deployment responded successfully.

## Automated checks

- [ ] `pnpm test` passes. This builds the scoring package and runs the scoring-core and web tests.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm exec prettier --check .` passes.
- [ ] `pnpm test:coverage` passes with the configured scoring-core and web thresholds.
- [ ] `pnpm test:e2e` passes against a local preview or dev server; use the Chrome smoke flow as a manual fallback when the host cannot launch a headless browser.
- [ ] Review `supabase/tests/match_rls.test.sql`, `supabase/tests/live_viewer_rls.test.sql`, `supabase/tests/account_deletion.test.sql`, `supabase/tests/table_tennis_scoring.test.sql`, `supabase/tests/squash_scoring.test.sql`, `supabase/tests/community_rules_rls.test.sql`, and `supabase/tests/release_guardrails.test.sql` in a disposable test database. The account deletion test covers owned data, reports, cascading events, and viewer access. Extend the Community Rules checks for all six sports, v2 validation, version locking, reports, and denied direct reads. Never run test setup against production data.
- [ ] Review `supabase/tests/atomic_match_sync.test.sql` in the same disposable database. Verify first write, idempotent retry, stale snapshot rejection, divergent snapshot rejection, and rollback when an event fails.
- [ ] Review `supabase/tests/cross_device_match_control.test.sql` and `supabase/tests/match_event_integrity.test.sql` in the same disposable database. Verify journal reads, initial lease, held lease, takeover, old-token rejection, complete read-only behavior, lease cleanup, duplicate-event rejection, sequence/sport validation, and journal completeness.
- [ ] `git diff --check` passes and no secret key appears in the browser bundle or repository.

## Match setup and scoring

- [ ] Start Badminton singles and doubles with Official Rules. Confirm setup shows one or two names per side and offers only valid first-server choices.
- [ ] Verify Badminton singles' parity-based service court, server changes after a lost rally, 21-point game with a two-point margin and 30-point cap, and next-game opening server.
- [ ] Verify Badminton doubles service court, server change, receiver positions, game completion, next-game opening server, and match completion against the current source in `docs/rules-sources.md`.
- [ ] Start a Pickleball doubles match with Official Rules. Verify the opening 0-0-2 server sequence, side-out transition, second server, court positions, game completion, and match completion.
- [ ] Start Pickleball singles with side-out scoring. Verify that a receiving-side rally does not award a point, service changes after the rally, and court side follows the serving player's score parity.
- [ ] Repeat Pickleball singles with rally scoring. Verify each rally winner scores and becomes the server, with service court following that player's score parity.
- [ ] Start Table tennis singles with best-of-three and best-of-five. Verify 11-point games, win by two, service changes every two points and every point at 10–10, the selected first server, next-game server, correction, undo/redo, and match completion.
- [ ] Start Table tennis doubles. Verify first server and receiver setup, previous-receiver/server-partner rotation, required next-game order confirmation, deciding-game side and receiving-order changes at five, and the Live Viewer markers.
- [ ] Start Squash singles with best-of-five and best-of-three. Verify PARS 11, win-by-two, service-box selection after hand-out, next-game server, score correction, undo/redo, and match completion.
- [ ] Start Squash doubles. Verify fixed server order, left/right receiver mapping, service-box alternation, next-game order confirmation, 11–10 completion, and Live Viewer state without names.
- [ ] Repeat representative scoring cases with guest custom rules. Confirm that each supported setting changes the engine result as expected and stays local to the current match.
- [ ] Confirm the court stays in the intended portrait orientation with a horizontal net and that score, service, and positions are readable at court-side viewing distance.

## Corrections and event history

- [ ] Award a point to each team and verify that the score, server, and positions update correctly.
- [ ] Undo a point, redo it, undo again, then continue scoring. Confirm the final state and event sequence remain consistent.
- [ ] Override a score to a valid pair of totals. Confirm the app records one override event and derives service and positions from the overridden state.
- [ ] Repeat point entry, undo, redo, and score correction in singles, and confirm the score, server, service court, history, and Live Viewer stay in sync.
- [ ] Repeat Table tennis point entry, undo, redo, score correction, history, sync, and Live Viewer checks in both singles and doubles.
- [ ] Try an invalid or out-of-range correction and confirm the app rejects it with a clear message.
- [ ] Refresh the match and verify the same score and local ruleset snapshot return.

## Guest storage and synchronization

- [ ] Start and play a match without Supabase configured. Confirm local scoring remains available and server-backed actions explain their unavailable state.
- [ ] With Supabase configured, start a guest match and verify its client-generated match and event UUIDs reach the server.
- [ ] Interrupt the network during scoring, reconnect, and verify queued events sync with the original UUIDs and in order.
- [ ] Retry the same sync more than once. Confirm no duplicate match or event rows appear.
- [ ] Force a stale or divergent journal snapshot in a disposable test account. Confirm the atomic sync rejects it and does not change the server state.
- [ ] Open the same active match in two tabs. Confirm only one tab controls it and the other remains read-only until control is released or explicitly taken over.
- [ ] Verify a singles match sent to Live Viewer shows one generic player per side and preserves the format while continuing to hide entered names.
- [ ] Verify guest expiry refreshes on accepted activity but never exceeds 24 hours from creation. Check expired records become inaccessible immediately and the hourly cleanup physically removes them and their events while the Supabase project is active.
- [ ] Record that Supabase Free may pause a low-activity project and delay physical cleanup; after any resume, inspect Cron history and remove remaining expired rows through the authorized cleanup procedure.

## Live Viewer

- [ ] Create a link from a guest match and open it in a private browser window without signing in.
- [ ] Confirm the viewer shows score and court positions without player-entered names, editing controls, or account identifiers.
- [ ] Score a point on the owner view and confirm the viewer updates. Disconnect the viewer and verify the stale/offline state is clear.
- [ ] Revoke the link and confirm later reads fail. Verify an expired link also fails.
- [ ] Confirm the viewer expires within 12 hours, no later than match data, and that reads do not refresh expiry. Treat the raw link as a bearer secret.

## Account foundation

- [ ] As a guest, click Google login and confirm the OAuth callback transfers an unexpired guest match through `transfer-guest-matches`; confirm an expired guest match is not transferred or claimed.
- [ ] Complete OAuth on local and Preview. Confirm the callback updates the session, guest transfer runs when a source guest token exists, and `claim_guest_matches()` runs once for matches already owned by the account, with a visible claiming state and a recoverable error state.
- [ ] Refresh the same browser and open `/history`; confirm matches are grouped into active and completed sections, ordered by `updated_at`, show sport/format/status/score/time, and open from server history even when the local snapshot is absent.
- [ ] Open `/history` and `/account` in English and Indonesian. Verify loading, empty, error, keyboard focus, 44 px controls, and narrow-phone layout.
- [ ] Sign out and confirm the account menu disappears and a new anonymous guest session is available.
- [ ] On Preview, delete a disposable Google test account after the second confirmation. Confirm match history, events, reports, rules, versions, viewer access, local match storage, and the Auth session are gone.
- [ ] Confirm user A cannot read or delete user B's history, and confirm no service-role key appears in the browser bundle or Vercel client variables.
- [ ] Repeat the complete account flow in a second browser. Confirm an active match hydrates from server history, remains read-only while another device owns control, takeover downloads the latest server snapshot, and a completed match opens read-only without a lease.
- [ ] Confirm a long journal hydrates through bounded definition plus event reads, polling does not overlap requests, hidden tabs pause polling, and returning to a visible tab revalidates the control lease.

## Community Rules rollout

- [ ] Confirm `/rules`, `/rules/new`, `/rules/:ruleId`, and the Indonesian equivalents open the intended directory, editor, and detail states.
- [ ] Confirm the directory filters all six sports and exposes loading, empty, unavailable, and RPC error states without false statistics or seed data.
- [ ] With a disposable Google account, create and edit a rule for every sport; verify canonical schema v2, optimistic-lock rejection, owner-only mutation, and publish/unpublish behavior.
- [ ] From detail and setup, use a published rule for singles, doubles, and Tennis/Padel mixed doubles where supported. Verify `source: "community"`, version, sport-specific configuration, and singles server normalization in the match definition snapshot.
- [ ] Edit or unpublish after match creation and confirm the existing match remains playable from its snapshot while new setup selections reject the unavailable rule.
- [ ] Submit valid/invalid reports anonymously, verify the three-per-hour limit, and process the queue only through the restricted SQL Editor runbook.
- [ ] Approve Community Rules for Production only after contact, moderation capacity, security, privacy, terms, and legal gates pass.

## Mobile, accessibility, and states

- [ ] Test a narrow phone viewport and a larger phone viewport. Confirm no horizontal overflow, clipped content, or controls below a 44 px tap target.
- [ ] Confirm the format selector fits narrow screens and can be changed with keyboard navigation.
- [ ] Check screen visibility with a device placed at a realistic court-side distance and brightness.
- [ ] Navigate the setup, match controls, dialogs, sharing, and reports with keyboard only. Confirm visible focus and Escape behavior for dialogs.
- [ ] Verify loading, empty, offline, expired, unavailable, and error states explain what happened and what the user can do next.
- [ ] Check English default and Indonesian copy for truncation or layout changes.

## Search indexing

- [ ] Confirm `/robots.txt` returns plain text and points to the deployed sitemap; confirm `/sitemap.xml` lists both language homepages and the public Community Rules directories with matching language alternates.
- [ ] Confirm `/`, `/id/`, `/rules`, and `/id/rules` return their own language-specific title, description, canonical URL, `hreflang` links, and the expected `WebSite` or `CollectionPage` structured data before JavaScript runs.
- [ ] Confirm setup, match, viewer, account, history, Community Rules detail, and Community Rules editor URLs return `X-Robots-Tag: noindex, nofollow` where applicable; confirm public directory refreshes resolve to their route-specific HTML entrypoints.
- [ ] In Google Search Console, submit the sitemap and inspect both language homepages after deployment. Request indexing if each page is available to Googlebot.

## Public-launch blockers to resolve

- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to Vercel Preview if Preview deployments will be used for server-backed smoke tests. Use only the public publishable key, never a service-role key.
- [ ] Set and verify the Supabase Auth anonymous sign-in rate limit (initial recommendation: 10 per IP per hour); keep CAPTCHA disabled initially and enable it only if abuse appears.
- [ ] Confirm new matches expose only Casual mode and old saved Referee matches remain readable.
- [ ] Apply the release-guardrail migration, verify the hourly `purge-expired-guest-data` Cron job succeeds, and confirm the job removes expired rows.
- [ ] Publish the approved privacy notice and terms with real operator and privacy contact details.
- [ ] Deploy Google OAuth, `delete-account`, and `transfer-guest-matches` to Preview first. Promote production only after the account foundation smoke test, guest-transfer test, deletion test, privacy notice, terms, and owner approval pass.
- [ ] Verify all Community Rules migrations, including `20261014100000_community_rules_all_sports.sql`, are applied in filename order. Confirm safe RPC reads work and direct table reads remain denied.
- [ ] Run the production smoke test after Vercel deployment and after the Supabase migrations/configuration are complete.
- [ ] Run the CI-equivalent checks: frozen install, format check, typecheck, unit tests, production build, production dependency audit, and Supabase pgTAP tests.
