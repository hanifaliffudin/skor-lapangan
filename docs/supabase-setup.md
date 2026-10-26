# Supabase setup

Supabase enables anonymous guest sync, configured OAuth sign-in, guest-match transfer, cross-device account history, single-editor match control, Live Viewer links, and Community Rules. All sports can be scored locally without Supabase, but server-backed features stay unavailable. Roll Community Rules out to Preview first and promote to Production only after the moderation, contact, security, and legal gates pass.

## 1. Configure the web app

Copy `apps/web/.env.example` to `apps/web/.env.local`, then set the project URL and publishable key from Supabase **Project Settings → API**:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
VITE_SITE_ORIGIN=https://your-public-domain.example
VITE_AUTH_PROVIDERS=google,github,apple
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
```

The Supabase URL and publishable key are meant for browser use. The hCaptcha site key is also public; get it from the active site in your hCaptcha account. Do not use a `service_role` key or the hCaptcha secret in the app, Vercel, or any committed file.

For the server-only Edge Functions, set `ALLOWED_ORIGINS` in the Supabase Functions environment to a comma-separated list of the exact production, Preview, and local origins that may call `delete-account` and `transfer-guest-matches`. Do not use a wildcard origin. Keep Preview URLs in this list only for the period they are being tested.

For Vercel, add the Supabase values, public origin, and provider list to the environments where the app will run, then redeploy. Add `VITE_HCAPTCHA_SITE_KEY` only when CAPTCHA protection is enabled. If hCaptcha domain allowlisting is enabled, include the production hostname. OAuth setup is not needed for guest scoring or Live Viewer links.

## 2. Apply the database migrations

In Supabase Dashboard, open **SQL Editor** and run each migration once, in filename order:

1. `supabase/migrations/20261008160000_initial_matches.sql`
2. `supabase/migrations/20261009100000_guest_matches_live_viewers.sql`
3. `supabase/migrations/20261009110000_community_rules.sql`
4. `supabase/migrations/20261009120000_safe_community_rule_reads.sql`
5. `supabase/migrations/20261009130000_revoke_community_rule_table_reads.sql`
6. `supabase/migrations/20261009140000_release_guardrails.sql`
7. `supabase/migrations/20261012110000_match_format_in_guest_payload.sql`
8. `supabase/migrations/20261012130000_tennis_scoring.sql`
9. `supabase/migrations/20261012140000_padel_scoring.sql`
10. `supabase/migrations/20261013100000_table_tennis_scoring.sql`
11. `supabase/migrations/20261013110000_squash_scoring.sql`
12. `supabase/migrations/20261013120000_atomic_match_sync.sql`
13. `supabase/migrations/20261013130000_atomic_match_sync_guard.sql`
14. `supabase/migrations/20261013140000_account_deletion.sql`
15. `supabase/migrations/20261013150000_guest_match_transfer.sql`
16. `supabase/migrations/20261014001000_fix_guest_transfer_anonymous_check.sql`
17. `supabase/migrations/20261014100000_community_rules_all_sports.sql`
18. `supabase/migrations/20261014110000_fix_community_match_snapshot.sql`
19. `supabase/migrations/20261014120000_harden_community_snapshot_source.sql`
20. `supabase/migrations/20261014130000_cross_device_match_control.sql`
21. `supabase/migrations/20261014140000_republish_community_rule.sql`
22. `supabase/migrations/20261014150000_scale_query_paths.sql`
23. `supabase/migrations/20261014160000_history_and_rules_search.sql`
24. `supabase/migrations/20261015100000_harden_match_event_integrity.sql`
25. `supabase/migrations/20261015101000_bound_match_journal_reads.sql`
26. `supabase/migrations/20261015110000_allow_legacy_guest_rule_snapshots.sql`
27. `supabase/migrations/20261015120000_club_sessions.sql`
28. `supabase/migrations/20261023150000_club_session_smart_rotation.sql`
29. `supabase/migrations/20261024100000_club_session_pickleball.sql`
30. `supabase/migrations/20261024110000_club_session_all_sports.sql`
31. `supabase/migrations/20261024120000_club_session_play_profiles.sql`
32. `supabase/migrations/20261026100000_club_session_local_time.sql`
33. `supabase/migrations/20261026110000_global_auth_providers.sql`
34. `supabase/migrations/20261026120000_club_session_write_guards.sql`

The migrations create match and event tables, idempotency constraints, guest retention and payload sanitization, Live Viewer functions, and their access policies. Keep all thirty-four migrations in filename order because later migrations replace functions created by earlier ones. The release-guardrail migration adds rate limits, hard guest retention caps, and an hourly `pg_cron` cleanup job. The Tennis migration adds ITF ruleset validation and privacy-limited Tennis viewer projections. The Padel migration adds FIP ruleset validation, the labeled club-singles variant, and privacy-limited Padel projections. The Table tennis migration adds ITTF ruleset validation, game-order confirmation events, sanitized state projections, and privacy-limited Table tennis viewer state. The Squash migration adds WSF singles/doubles validation, service-box and order events, sanitized state projections, and privacy-limited Squash viewer state. The atomic sync migrations wrap the match snapshot and event journal in one transaction, reject stale or divergent snapshots, and keep the RPC independent of private helper permissions. The account-deletion migration adds a restricted RPC that removes user-owned data before the server-only Edge Function deletes the Auth user. The guest-transfer migration adds the server-only RPC that moves unexpired guest matches to a durable account after OAuth. The guest-transfer repair migration checks `auth.users.is_anonymous` so existing anonymous sessions are recognized correctly. The Community Rules migrations expand sport validation to all six sports, preserve legacy reads, harden match snapshots, and keep publishing behind the existing RPC/RLS boundary. The cross-device migration adds the account journal reader, a 45-second single-editor lease, takeover and heartbeat RPCs, and control-token validation in `sync_match_journal`. The republish migration adds an owner-only RPC that changes only public visibility without creating a new rule version. The scale and history migrations add keyset-paginated history/rules reads, compact match heads, incremental event reads, bounded journal hydration, search indexes, and the polling query paths used by the web client. The event-integrity migration rejects duplicate or divergent event identities, sport/sequence mismatches, and incomplete journals at commit time. The Club Sessions migration adds private account-owned doubles sessions, roster and court records, queue assignments, match attachment, and owner-only RLS. The Smart Rotation migration adds pairing mode, player profile controls, and auditable open-doubles fallback flags. The two Club Session sport-expansion migrations expand the supported session sport constraint to all six sports. The Play Profile migration persists sport-aware profile IDs, permits singles session formats, and allows nullable second-player slots for singles queue entries. The local-time migration adds a start time, IANA time zone, and optional location to new session boards. The global-auth migration makes the account and Community Rules boundary provider-neutral. The write-guard migration adds database-side assignment validation, IANA time-zone validation, session freshness timestamps, and the transactional queue RPC; all eight Club Session and global-auth migrations must be applied before deploying the current frontend.

For a fresh environment, apply all thirty-four migrations in filename order before deploying the app. For an existing live environment, apply pending migrations in filename order before deploying code that depends on them. Apply `20261012110000_match_format_in_guest_payload.sql` before code that creates or shares singles matches, `20261012130000_tennis_scoring.sql` before public Tennis promotion, `20261012140000_padel_scoring.sql` before public Padel promotion, `20261013100000_table_tennis_scoring.sql` before public Table tennis promotion, `20261013110000_squash_scoring.sql` before public Squash promotion, both atomic sync migrations before deploying the client that uses the atomic sync RPC, all three account migrations before deploying the account Edge Functions, `20261014100000_community_rules_all_sports.sql` before deploying the Community Rules frontend, `20261014130000_cross_device_match_control.sql` before deploying the frontend that reads or controls account matches across devices, `20261014140000_republish_community_rule.sql` before deploying the republish action, `20261014160000_history_and_rules_search.sql` before deploying the search and polling client, `20261015100000_harden_match_event_integrity.sql` plus `20261015101000_bound_match_journal_reads.sql` before deploying the hardened cross-device reader, `20261015110000_allow_legacy_guest_rule_snapshots.sql` before promoting the matching frontend fix, `20261015120000_club_sessions.sql` before deploying the Club Sessions board, `20261023150000_club_session_smart_rotation.sql` before deploying Smart Rotation, `20261024100000_club_session_pickleball.sql` before deploying Pickleball Club Sessions, `20261024110000_club_session_all_sports.sql` before deploying all-sport Club Sessions, `20261024120000_club_session_play_profiles.sql` before deploying singles and short-round Club Session profiles, `20261026100000_club_session_local_time.sql` before deploying time and location fields, and `20261026110000_global_auth_providers.sql` before deploying provider-neutral account and Community Rules code, then `20261026120000_club_session_write_guards.sql` before deploying the atomic Club Session queue path. Do not rerun earlier migrations to apply a later schema change.

Expired guest records become unreadable at 12 hours after last accepted server activity, capped at 24 hours after creation. Live Viewer links expire within 12 hours and no later than match expiry; reads do not refresh the link. The migration schedules `purge_expired_guest_matches()` hourly, removing expired matches/events and rate-limit counters; anonymous Auth users older than 30 days are also deleted. Cleanup timing is not the access-control boundary. After the next hour, check Supabase Cron run history and verify the job succeeded.

## 3. Enable anonymous sign-ins

In Supabase Authentication settings, enable **Anonymous Sign-Ins**. The app creates an anonymous Supabase user for a guest browser so row-level policies can protect its temporary match records. The browser keeps the guest match locally too and retries sync after connectivity returns. Set the anonymous sign-in rate limit to 10 per IP per hour for the initial public release, if the control is available in the project. Database limits also cap match, event, and viewer actions per guest account.

If CAPTCHA protection is enabled, select hCaptcha in Supabase Authentication's bot protection settings and store the hCaptcha secret there. The app displays the hCaptcha check only when Supabase requires a CAPTCHA token for guest sign-in, then sends the verified token with the anonymous sign-in request. Keep the secret only in the hCaptcha and Supabase dashboards. The public site key belongs in `VITE_HCAPTCHA_SITE_KEY`.

Start with CAPTCHA disabled and monitor abuse and failed sign-ins. Enable hCaptcha only if repeated abuse appears; the sign-in UI already handles a CAPTCHA challenge when Supabase requests it. With CAPTCHA disabled, the Auth IP limit and database action limits are the active protections.

hCaptcha does not accept `localhost` or `127.0.0.1` as the challenge hostname. To test locally, map a development hostname such as `dev.your-domain.com` to `127.0.0.1` in the machine's hosts file, then start Vite with `HCAPTCHA_DEV_HOST=dev.your-domain.com pnpm dev` and open that hostname on port `5173`. If hCaptcha domain allowlisting is enabled, add the development hostname there too. Otherwise, test on a deployed Vercel URL.

## 4. Enable OAuth sign-in and account foundation

Enable the providers listed in `VITE_AUTH_PROVIDERS` on local and Vercel Preview with disposable test accounts. Production promotion waits for the Preview smoke test and the privacy/legal release gate. Community Rules use the same durable-account owner gate and anonymous report session; keep production publication closed until moderation contact and response capacity are approved.

1. Create an OAuth client for each provider you enable. Google, GitHub, and Apple are supported by the current web provider registry.
2. In each provider's authorized redirect URIs, add the Supabase callback URL:
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. In Supabase **Authentication → Providers**, enable each selected provider and enter its client ID and secret.
4. In Supabase **Authentication → URL Configuration**, set the local Site URL to `http://127.0.0.1:5173` and add the production URL to the redirect allow list. Add the Vercel domain you use for production (and any preview domains you intend to test).
5. Deploy the server-only account functions from the repository root:
   `supabase functions deploy delete-account`
   `supabase functions deploy transfer-guest-matches`
6. Confirm both functions have access to the platform-provided `SUPABASE_SERVICE_ROLE_KEY`. Keep that key in Supabase's server-side function environment only.
7. If a provider cannot be enabled yet, remove it from `VITE_AUTH_PROVIDERS`. Guest scoring and guest Live Viewer links do not depend on OAuth.

Keep every OAuth client secret only in Supabase Dashboard. Do not add them to `.env.local`, Vercel environment variables, or the repository.

## 5. Verify the setup

- Start a match while signed out. The app should use an anonymous Supabase user and show sync status as it saves.
- Create a Live Viewer link and open it in a private window. The page should show only the score, court positions, serving state, and update time.
- Revoke the link. A subsequent viewer refresh should show that it is unavailable.
- Open `/history` and `/id/history`; as a guest they should show the configured account sign-in state. Open `/rules` and `/id/rules`; the directory should load, show a clear empty/error state when the database has no rules, and expose all six sport filters. Open `/rules/new` as a guest and confirm the durable-account gate.
- Start a guest match, sign in with each configured provider, refresh, and confirm the unexpired match is transferred and appears in history only for that account. Confirm an expired guest match is not transferred or claimed.
- Sign out and confirm the app creates a new anonymous guest session. On Preview, use a disposable account to confirm `/account` deletion removes history, local match storage, and the Auth session.
- Verify `purge-expired-guest-data` is scheduled hourly and inspect its first successful run in Supabase Cron.
- Disconnect the browser, score a point, then reconnect. The same client-generated event UUID should be retried rather than creating a second event.
- Confirm the browser calls `sync_match_journal` and that a rejected stale or divergent snapshot leaves the server score unchanged.
- With one disposable account, open an active match in two browser profiles. Confirm the second profile loads the server journal as read-only, polling updates its score, and **Ambil alih** fetches the latest server snapshot before enabling input.
- Complete the match in the controlling profile, then open it from the second profile and confirm it is readable without acquiring a lease.

The SQL policy tests live in `supabase/tests/`. The first file, `000-setup-tests-hooks.sql`, installs the Supabase pgTAP test helpers in the disposable local database before the remaining tests run. With Docker and the Supabase CLI available, run `supabase start` and `supabase test db`; use `supabase db reset` first when you need to replay every migration. They are not safe to run against production data as a general test suite.
The `20261015110000_allow_legacy_guest_rule_snapshots.sql` migration keeps strict source validation for account matches while allowing the intentionally redacted rules snapshot used by older guest payloads. Apply it before promoting the matching frontend fix.
