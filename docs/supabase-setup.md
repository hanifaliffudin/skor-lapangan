# Supabase setup

Supabase enables anonymous guest sync, account history, Live Viewer links, and Community Rules. Badminton and Pickleball scoring still works locally without it, but server-backed features stay unavailable.

## 1. Configure the web app

Copy `apps/web/.env.example` to `apps/web/.env.local`, then set the project URL and publishable key from Supabase **Project Settings → API**:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
```

The Supabase URL and publishable key are meant for browser use. The hCaptcha site key is also public; get it from the active site in your hCaptcha account. Do not use a `service_role` key or the hCaptcha secret in the app, Vercel, or any committed file.

For Vercel, add the two Supabase values to the environments where the app will run, then redeploy. Add `VITE_HCAPTCHA_SITE_KEY` only when CAPTCHA protection is enabled. If hCaptcha domain allowlisting is enabled, include the production hostname. A separate Google OAuth setup is not needed for guest scoring or Live Viewer links.

## 2. Apply the database migrations

In Supabase Dashboard, open **SQL Editor** and run each migration once, in filename order:

1. `supabase/migrations/20261008160000_initial_matches.sql`
2. `supabase/migrations/20261009100000_guest_matches_live_viewers.sql`
3. `supabase/migrations/20261009110000_community_rules.sql`
4. `supabase/migrations/20261009120000_safe_community_rule_reads.sql`
5. `supabase/migrations/20261009130000_revoke_community_rule_table_reads.sql`

The migrations create the match and event tables, idempotency constraints, guest retention and payload sanitization, Live Viewer functions, Community Rules tables, and their access policies. The final two migrations add safe read functions and then revoke direct client reads of Community Rules tables.

For a fresh environment, apply all five migrations in filename order before deploying the current web app. For an existing live environment, stage the change to avoid breaking the currently deployed app: apply migration `20261009120000_safe_community_rule_reads.sql`, deploy the updated frontend, then apply migration `20261009130000_revoke_community_rule_table_reads.sql`. The old frontend depends on direct table reads until it is replaced. Do not rerun earlier migrations to apply this security fix.

Expired guest records become unreadable as soon as their 12-hour server expiry passes. The `purge_expired_guest_matches()` function removes expired rows and their events; schedule it periodically if database cleanup is desired. Cleanup timing is not the access-control boundary.

## 3. Enable anonymous sign-ins

In Supabase Authentication settings, enable **Anonymous Sign-Ins**. The app creates an anonymous Supabase user for a guest browser so row-level policies can protect its temporary match records. The browser keeps the guest match locally too and retries sync after connectivity returns.

If CAPTCHA protection is enabled, select hCaptcha in Supabase Authentication's bot protection settings and store the hCaptcha secret there. The app displays the hCaptcha check only when Supabase requires a CAPTCHA token for guest sign-in, then sends the verified token with the anonymous sign-in request. Keep the secret only in the hCaptcha and Supabase dashboards. The public site key belongs in `VITE_HCAPTCHA_SITE_KEY`.

With CAPTCHA protection disabled, anonymous sign-ins have less protection against automated abuse. Re-enable it before a broader public release after configuring the hCaptcha site key.

hCaptcha does not accept `localhost` or `127.0.0.1` as the challenge hostname. To test locally, map a development hostname such as `dev.your-domain.com` to `127.0.0.1` in the machine's hosts file, then start Vite with `HCAPTCHA_DEV_HOST=dev.your-domain.com pnpm dev` and open that hostname on port `5173`. If hCaptcha domain allowlisting is enabled, add the development hostname there too. Otherwise, test on a deployed Vercel URL.

If a guest later links Google, the app links that identity to the same Supabase user and claims unexpired matches into account history. Enable manual identity linking in the Authentication settings if the project requires it.

## 4. Optional: enable Google sign-in

Google OAuth is optional for guest play. It is needed for durable account history and to create, edit, or unpublish Community Rules.

1. Create a Google OAuth client for a web application.
2. In Google Cloud's authorized redirect URIs, add the Supabase callback URL:
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. In Supabase **Authentication → Providers → Google**, enable the provider and enter the client ID and secret.
4. In Supabase **Authentication → URL Configuration**, set the local Site URL to `http://127.0.0.1:5173` and add the production URL to the redirect allow list. Add the Vercel domain you use for production (and any preview domains you intend to test).
5. If your Google Cloud account cannot enable OAuth without billing, leave Google disabled for now. Guest scoring and guest Live Viewer links do not depend on Google.

Keep the Google client secret only in Supabase Dashboard. Do not add it to `.env.local`, Vercel environment variables, or the repository.

## 5. Verify the setup

- Start a match while signed out. The app should use an anonymous Supabase user and show sync status as it saves.
- Create a Live Viewer link and open it in a private window. The page should show only the score, court positions, serving state, and update time.
- Revoke the link. A subsequent viewer refresh should show that it is unavailable.
- If Google is enabled, link the guest session and check that the match appears in account history. Publish a Community Rule and confirm it is visibly labeled unofficial.
- Confirm anonymous users can read published rules through the app, but direct `community_rules` and `community_rule_versions` table reads are denied. Verify creator identifiers are absent from all public responses.
- Disconnect the browser, score a point, then reconnect. The same client-generated event UUID should be retried rather than creating a second event.

The SQL policy tests live in `supabase/tests/`. They use the Supabase pgTAP testing helpers and should be run in a disposable local Supabase database after migrations; they are not safe to run against production data as a general test suite.
