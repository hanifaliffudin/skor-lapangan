# Operations runbook

This runbook covers the current Vercel and Supabase deployment. Confirm the live dashboard settings before each release because environment values and provider settings are not stored in this repository.

## Environments and secrets

The Vite web app reads these browser environment variables:

| Variable                        | Use                                              | Handling                                                  |
| ------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project endpoint                        | Public browser configuration                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client access subject to RLS            | Public browser key. Do not substitute a service-role key. |
| `VITE_HCAPTCHA_SITE_KEY`        | hCaptcha widget when Supabase CAPTCHA is enabled | Public site key. Omit while CAPTCHA is disabled.          |

Keep the Google OAuth secret, hCaptcha secret, and Supabase service-role key in their respective trusted dashboards or server-only secret stores. Never add them to a `VITE_` variable, frontend build, issue, or repository.

The app can score locally without Supabase configuration. Guest server sync, Google account features, and Live Viewer require the Supabase project configuration. Community Rules remain deferred behind a separate moderation and legal gate.

## Deploy the web app

1. Run the automated checks in [qa-release-checklist.md](qa-release-checklist.md).
2. Import the repository into Vercel with the repository root unchanged. `vercel.json` builds the pnpm workspace and publishes `apps/web/dist`.
3. Add the Supabase URL and publishable key to the appropriate Vercel environment. Add the hCaptcha site key only when Supabase CAPTCHA is enabled.
4. Deploy a preview and run the production-like smoke checks before promoting it.
5. Confirm the deployed URL is included in Supabase Auth's allowed redirect URLs when Google OAuth is enabled.
6. After promotion, test direct route refresh, guest match creation, score sync, and Live Viewer access from a separate browser.

For rollback, use Vercel's previous known-good deployment. Treat database migrations as forward-only. Do not reverse a schema migration by dropping production tables without an explicit recovery plan.

## Apply Supabase migrations

For each new environment, run the SQL files once in filename order using the Supabase SQL Editor:

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

Do not omit Community Rules migrations from a fresh setup: `20261009140000_release_guardrails.sql` depends on their schema even though V1.0 does not expose those features. Do not rerun the initial migration to fix a later migration. Check which migrations already ran, take or verify a recovery point using the project's available Supabase controls, then apply only the pending migration. For an existing live deployment, follow the safe-read rollout order for migrations `20261009120000` and `20261009130000`, then apply pending migrations in filename order before deploying this frontend. Keep filenames immutable after release and add a new migration for later schema changes. The release-guardrail migration enables `pg_cron` and installs an hourly cleanup job; verify the extension and job exist in Supabase after applying it. The atomic sync migration must be applied before deploying a client that calls `sync_match_journal`.
The `20261014001000_fix_guest_transfer_anonymous_check.sql` migration updates the guest-transfer RPC to use Supabase's `auth.users.is_anonymous` flag, so apply it before testing OAuth guest transfer on an existing deployment.

## Forward-only migration recovery and rollback

Database migrations are forward-only. A web deployment can roll back to a previous Vercel deployment, but an applied database migration must not be undone by editing its file, deleting its function, dropping production tables, or manually changing migration history.

### Before applying a migration

1. Confirm the target project and take or verify a provider recovery point according to the project's backup policy.
2. Inspect the migration history without changing data:

   ```bash
   npx --yes supabase@latest migration list
   ```

   If SQL access is required, inspect `supabase_migrations.schema_migrations` in the target project and compare the result with the repository filenames.

3. Apply pending files in filename order. The atomic sync migrations must be present before deploying a frontend that calls `sync_match_journal`.
4. Verify the RPC signature, grants, RLS policies, viewer projection, and cleanup job before promoting the web deployment.

### If a migration fails

1. Stop the rollout and keep the last known-good web deployment available.
2. Check migration history and provider logs before retrying. Do not assume a failure left no changes and do not mark a migration applied by hand.
3. Reproduce the failure against a disposable database. Fix the cause in a new migration or correct the migration before it has been applied anywhere.
4. Run the database test suite and `git diff --check`, then apply the new migration with `supabase db push --yes` from a linked, authorized operator session.
5. Re-run migration history and read-only schema checks. Record the result in the release evidence.

### If the web release needs rollback

1. Repoint Vercel to the previous known-good deployment.
2. Confirm that deployment is compatible with the current database schema. Keep the database migration in place when it is additive or required by existing clients. Test compatibility in Preview when the migration changes RPC or payload behavior.
3. Keep scoring local-first while the incident is investigated. Do not ask operators to delete browser journals or change match IDs to bypass a sync error.
4. If the database itself is damaged, stop writes through the affected feature and use the provider's authorized recovery process. Restore from a verified recovery point only with owner approval, then replay or repair through a new forward migration.
5. Add a permanent forward fix, verify migration history and smoke tests, and only then deploy a frontend that depends on it again.

The atomic sync path reports `stale` and `conflict` instead of overwriting a newer snapshot. Treat those responses as an incident input, not as a reason to force a last-write-wins update. See [ADR 0002](adr/0002-atomic-match-sync.md) for the consistency decision.

## Configure Supabase Auth

- Enable Anonymous Sign-Ins for guest play and sync.
- Enable Google OAuth and the guest-match transfer flow for local and Preview after applying the account-deletion and guest-transfer migrations. Keep Community Rules disabled until its separate moderation and legal gate passes.
- Deploy `supabase/functions/delete-account` with `supabase functions deploy delete-account` and `supabase/functions/transfer-guest-matches` with `supabase functions deploy transfer-guest-matches`. The service-role key must remain in the Edge Function environment and must never be added to Vercel client variables.
- Set the Anonymous Sign-Ins rate limit in Supabase Auth to 10 sign-ins per IP per hour for the initial public release, if that control is available in the project. The database migration separately limits guest match creation (10/hour), match-state updates (500/hour), event inserts (500/hour), Live Viewer link creation (10/hour), and viewer reads (600/minute per match). Community Rule report limits remain in the schema for V1.1. These are safety ceilings, not expected usage targets.
- Start with CAPTCHA disabled and monitor Auth errors and report volume. If repeated guest-signup abuse appears, enable Supabase CAPTCHA with hCaptcha, configure its secret in Supabase, the public site key in Vercel, and allowed hostnames in hCaptcha, then verify the challenge on the deployed hostname. The UI already supports a CAPTCHA response when Supabase requests one.
- Do not assume an authentication provider is active because its environment variables exist. Test it from the deployed app.

## Guest expiry and database cleanup

Guest match records expire 12 hours after the last accepted server activity, with a hard cap of 24 hours after creation. A guest session cannot remove the expiry flag or extend the hard cap. Viewer links expire after at most 12 hours and no later than the match; reads do not extend either expiry. Expired guest matches are inaccessible immediately. An hourly `pg_cron` job physically deletes matches and cascades their events, removes old rate-limit counters, and deletes anonymous Auth users older than 30 days. The 30-day account cleanup is separate from 12/24-hour game-data retention.

After migration, verify the `purge-expired-guest-data` Cron job in Supabase and inspect its run history after the next hour. If it fails, fix the database error and rerun the cleanup function from SQL Editor as an authorized operator. Never run it from the browser or expose a service-role key. While the project is active and the job is healthy, physical deletion should happen within about an hour after expiry; a missed job delays deletion but does not restore access to expired data.

Supabase Free projects with low activity may be paused after seven days. A paused project cannot run its database Cron job, so physical deletion can be delayed until the project resumes. Treat the hourly cleanup interval as an active-project target, not a deletion SLA. After resuming a project, check the Cron run history and invoke the cleanup function as an authorized operator if expired rows remain. See [Supabase's Free project pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing) for current conditions.

## V1.1 only: Community Rule reports

This procedure is not part of V1.0 public operations. Do not accept Community Rules submissions or reports until the V1.1 policy, owner contact, response capacity, and security checks are approved.

Reports are open to guests and Google-linked users; Google sign-in is not required. The optional email is only for follow-up. Each anonymous account can send up to three reports per hour. Reports do not automatically unpublish a rule, and Community Rules remain open for publication without pre-approval. Review them manually in Supabase SQL Editor using a restricted project session:

```sql
select id, rule_id, reporter_id, reporter_contact, reason, details,
       status, resolution, created_at, reviewed_at, review_notes
from public.community_rule_reports
where status in ('open', 'reviewing')
order by created_at asc;
```

Keep queue access restricted because it can contain reporter IDs, details, and optional contact emails. Triage reports as `open` → `reviewing` → `actioned` or `dismissed`; record the decision rationale (and reviewer initials if useful) in `review_notes`. Set `reviewed_at` when a final decision is made. To mark a report as under review:

```sql
update public.community_rule_reports
set status = 'reviewing'
where id = '<report-uuid>' and status = 'open';
```

Aim to review unsafe or rights-related reports within 48 hours and other reports within seven days; these are internal targets, not a promised SLA. Do not hide a rule just because it received reports. When removal is justified, unpublish the rule and resolve the report in one SQL transaction:

```sql
begin;
update public.community_rules
set is_published = false
where id = '<rule-uuid>';

update public.community_rule_reports
set status = 'actioned',
    resolution = 'unpublished',
    reviewed_at = now(),
    review_notes = 'Reason for the decision'
where id = '<report-uuid>';
commit;
```

For a report that does not warrant action, set `status = 'dismissed'`, `resolution = 'no_action'`, and record a short explanation. Use `requested_edit` only if the operator can contact the creator; this release does not send creator notifications. `removed` is reserved for a deliberate deletion and recovery decision. Deleting a Community Rule sets `rule_id` to null on its reports so the moderation record is retained; include the deleted rule ID in `review_notes` if needed for context. The repository has no in-app moderator dashboard, appeal form, or automatic report-count threshold.

## Smoke test after a deployment

- Open the homepage in a fresh browser profile and start a guest Badminton match.
- Award a point, undo it, redo it, and confirm the displayed score, server, and positions.
- Refresh the match and check that the local journal returns and sync status is understandable.
- Create a Live Viewer link, open it in a private window, score a point, then revoke the link and confirm access stops.
- Play one Table tennis and one Squash match in a fresh browser profile, including a doubles order confirmation and a reload during an active game.
- Turn off the network, record a point, restore the network, and verify the score remains local until the next successful atomic sync.
- Visit `/history` as a guest and confirm the Google sign-in state. Visit `/rules` and confirm it redirects to the home page; confirm the header keeps Community Rules unavailable.
- Review browser console and network errors. Do not use a real player's private information in test matches.

## Automated checks

The repository CI runs application checks with a frozen pnpm lockfile, formatting, type checking, unit tests, production build, and a production dependency audit. A separate job starts a disposable Supabase database, applies every migration, and runs the pgTAP files under `supabase/tests/`. Run the same checks locally when Docker and the Supabase CLI are available; never point the SQL tests at the active project.

## Troubleshooting

| Symptom                                     | Checks                                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest sign-in fails                         | Confirm Supabase URL/key, Anonymous Sign-Ins, provider status, and the CAPTCHA setting. If CAPTCHA is enabled, verify the site key and allowed hostname.               |
| Match stays local or sync fails             | Check network, Supabase status, current guest session, and browser console. Retry after connectivity returns. Do not manually change IDs to force a retry.             |
| Match controls are read-only in another tab | Check whether another tab holds the match control lock. Close or release the controlling tab, then retry.                                                              |
| Live Viewer says unavailable                | Check token expiry, revocation, match expiry, Supabase configuration, and the `read_live_viewer` RPC result. Create a new link only if the owner still wants to share. |
| A deferred Community Rules URL opens        | Confirm the app redirects `/rules` routes to the localized home page. Verify that Google account controls do not expose Community Rules.                               |

## Current operational gaps

- CAPTCHA remains disabled initially; review anonymous Auth limits and abuse reports before enabling it.
- Verify the hourly `purge-expired-guest-data` Cron job and its run history after the next successful hour.
- Account deletion is an account-foundation operation and must be tested in Preview with a disposable account before production promotion. Community Rules moderation remains a separate unreleased operation.
- Older database setups expose creator identifiers through direct Community Rules table reads until migration `20261009130000_revoke_community_rule_table_reads.sql` is applied. Verify direct reads are denied and safe read functions work after applying both Community Rules migrations.
- New V1 matches use the single Casual workflow. Referee is hidden until it has meaningfully different controls; historical matches retain their saved mode label.
- Multi-device scoring is treated as single-writer: a stale or divergent journal is rejected by `sync_match_journal` rather than overwriting the server snapshot. Investigate the sync conflict before continuing from another device.
- Privacy notice and terms still require real operator details, monitored contacts, provider verification, and legal approval. Track those actions in the [legal and owner release gate](legal-release-gate.md).
