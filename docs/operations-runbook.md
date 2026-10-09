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

Do not rerun the initial migration to fix a later migration. Check which migrations already ran, take or verify a recovery point using the project's available Supabase controls, then apply only the pending migration. For an existing live deployment, apply migration `20261009120000_safe_community_rule_reads.sql`, deploy the updated frontend, then apply migration `20261009130000_revoke_community_rule_table_reads.sql`. The final migration denies direct reads used by the old frontend, so do not apply it before the updated frontend is deployed. Ask users with an already-open older tab to refresh after revoking table access. Keep the filenames immutable after release and add a new migration for later schema changes.

## Configure Supabase Auth

- Enable Anonymous Sign-Ins for guest play and sync.
- Enable Google OAuth only if account history and Community Rules publishing are needed. Configure the Google OAuth client secret in Supabase, not in Vercel's frontend environment.
- If manual identity linking is required by the project, enable it so a guest can link Google and claim still-valid matches.
- CAPTCHA is currently disabled for local testing. Before broad public access, choose the abuse-protection setting. If enabling hCaptcha, configure the secret in Supabase, the public site key in Vercel, and the allowed hostnames in hCaptcha. Verify the flow on the deployed hostname.
- Do not assume an authentication provider is active because its environment variables exist. Test it from the deployed app.

## Guest expiry and database cleanup

Supabase denies reads and writes for expired guest records as soon as their 12-hour expiry passes. The migration also creates `public.purge_expired_guest_matches()`, which physically deletes expired guest matches and cascades their events. The repository does not configure a schedule for this function.

Before launch, decide whether and how to schedule the function using a trusted server-side scheduler. Only `service_role` can execute it. Check the current Supabase plan and any scheduler cost before enabling it. Never run it from the browser or expose a service-role key. If no schedule exists, expired rows remain inaccessible but may remain stored until an operator runs cleanup.

## Community Rule reports

The app stores reports in `public.community_rule_reports`. The current app has no moderation dashboard and reports do not automatically unpublish a rule. Until a dedicated review flow exists, an authorized operator can inspect the report queue in Supabase SQL Editor:

```sql
select id, rule_id, reporter_id, reason, details, created_at
from public.community_rule_reports
order by created_at desc;
```

Limit access to this query because it may include reporter IDs and report details. The operator must establish a review owner, removal criteria, contact, and appeal path before announcing the Community Rules directory publicly. Publishing remains open without pre-approval.

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

- CAPTCHA protection is disabled for local testing and must be reviewed before broad public access.
- The expired guest cleanup function has no schedule configured by the repository.
- There is no self-service account deletion flow or published support contact.
- Community Rule reports have no in-app moderation queue or staff unpublish action.
- Older database setups expose creator identifiers through direct Community Rules table reads until migration `20261009130000_revoke_community_rule_table_reads.sql` is applied. Verify direct reads are denied and safe read functions work after applying both Community Rules migrations.
- Casual and Referee currently have the same match controls.
