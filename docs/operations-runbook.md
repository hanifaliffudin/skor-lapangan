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

The app can score locally without Supabase configuration. Guest server sync, account history, Community Rules, and Live Viewer require the Supabase project configuration.

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

Do not rerun the initial migration to fix a later migration. Check which migrations already ran, take or verify a recovery point using the project's available Supabase controls, then apply only the pending migration. For an existing live deployment, follow the existing safe-read rollout order for migrations `20261009120000` and `20261009130000`, then apply `20261009140000_release_guardrails.sql` before deploying this frontend. The new migration keeps the old report RPC as a backward-compatible wrapper. Ask users with an already-open older tab to refresh after revoking table access. Keep filenames immutable after release and add a new migration for later schema changes. The new migration enables `pg_cron` and installs an hourly cleanup job; verify the extension and job exist in Supabase after applying it.

## Configure Supabase Auth

- Enable Anonymous Sign-Ins for guest play and sync.
- Enable Google OAuth only if account history and Community Rules publishing are needed. Configure the Google OAuth client secret in Supabase, not in Vercel's frontend environment.
- If manual identity linking is required by the project, enable it so a guest can link Google and claim still-valid matches.
- Set the Anonymous Sign-Ins rate limit in Supabase Auth to 10 sign-ins per IP per hour for the initial public release, if that control is available in the project. The database migration separately limits guest match creation (10/hour), match-state updates (500/hour), event inserts (500/hour), Live Viewer link creation (10/hour), viewer reads (600/minute per match), and Community Rule reports (3/hour) per anonymous account or viewer capability. These are safety ceilings, not expected usage targets.
- Start with CAPTCHA disabled and monitor Auth errors and report volume. If repeated guest-signup abuse appears, enable Supabase CAPTCHA with hCaptcha, configure its secret in Supabase, the public site key in Vercel, and allowed hostnames in hCaptcha, then verify the challenge on the deployed hostname. The UI already supports a CAPTCHA response when Supabase requests one.
- Do not assume an authentication provider is active because its environment variables exist. Test it from the deployed app.

## Guest expiry and database cleanup

Guest match records expire 12 hours after the last accepted server activity, with a hard cap of 24 hours after creation. A guest session cannot remove the expiry flag or extend the hard cap. Viewer links expire after at most 12 hours and no later than the match; reads do not extend either expiry. Expired guest matches are inaccessible immediately. An hourly `pg_cron` job physically deletes matches and cascades their events, removes old rate-limit counters, and deletes anonymous Auth users older than 30 days. The 30-day account cleanup is separate from 12/24-hour game-data retention.

After migration, verify the `purge-expired-guest-data` Cron job in Supabase and inspect its run history after the next hour. If it fails, fix the database error and rerun the cleanup function from SQL Editor as an authorized operator. Never run it from the browser or expose a service-role key. While the project is active and the job is healthy, physical deletion should happen within about an hour after expiry; a missed job delays deletion but does not restore access to expired data.

Supabase Free projects with low activity may be paused after seven days. A paused project cannot run its database Cron job, so physical deletion can be delayed until the project resumes. Treat the hourly cleanup interval as an active-project target, not a deletion SLA. After resuming a project, check the Cron run history and invoke the cleanup function as an authorized operator if expired rows remain. See [Supabase's Free project pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing) for current conditions.

## Community Rule reports

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
- Open the Community Rules directory without signing in. If Google OAuth is enabled, create a test rule, edit it, share it, report it from another account, and unpublish it as the owner.
- Review browser console and network errors. Do not use a real player's private information in test matches.

## Troubleshooting

| Symptom                                     | Checks                                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest sign-in fails                         | Confirm Supabase URL/key, Anonymous Sign-Ins, provider status, and the CAPTCHA setting. If CAPTCHA is enabled, verify the site key and allowed hostname.               |
| Match stays local or sync fails             | Check network, Supabase status, current guest session, and browser console. Retry after connectivity returns. Do not manually change IDs to force a retry.             |
| Match controls are read-only in another tab | Check whether another tab holds the match control lock. Close or release the controlling tab, then retry.                                                              |
| Live Viewer says unavailable                | Check token expiry, revocation, match expiry, Supabase configuration, and the `read_live_viewer` RPC result. Create a new link only if the owner still wants to share. |
| Community Rule is missing                   | Confirm it is published, belongs to a supported sport, and the directory request has no Supabase error. Unpublished rules are visible only to their owner.             |
| Report received no visible action           | Reports are stored but are not automatically moderated. Follow the operator's manual review process.                                                                   |

## Current operational gaps

- CAPTCHA remains disabled initially; review anonymous Auth limits and abuse reports before enabling it.
- Verify the hourly `purge-expired-guest-data` Cron job and its run history after the next successful hour.
- There is no self-service account deletion flow or published support contact.
- Community Rule reports are manually reviewed in SQL Editor; there is no moderator dashboard or creator-notification workflow.
- Older database setups expose creator identifiers through direct Community Rules table reads until migration `20261009130000_revoke_community_rule_table_reads.sql` is applied. Verify direct reads are denied and safe read functions work after applying both Community Rules migrations.
- New V1 matches use the single Casual workflow. Referee is hidden until it has meaningfully different controls; historical matches retain their saved mode label.
