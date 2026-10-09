# Privacy notice

**Status: Draft for owner and legal review. Do not publish this draft as the final notice.**

This draft maps the data paths currently visible in the repository. It is not a statement that the product meets a particular legal standard. Recheck it against the deployed Supabase and Vercel settings before publication.

## Operator details to complete

- Service operator: `[OWNER LEGAL NAME]`
- Privacy contact: `[PRIVACY CONTACT EMAIL]`
- Postal or business address, if applicable: `[OWNER ADDRESS]`
- Intended service region and governing jurisdiction: `[OWNER TO DECIDE]`
- Notice effective date: `[DATE OF PUBLICATION]`

## Data the app handles

| Data                          | Where it is handled               | Purpose and current retention                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup draft                   | Browser session storage           | Keeps the selected sport, mode, and Community Rule while setup is in progress. The browser removes session storage when that tab session ends.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Guest match journal           | Browser local storage             | Holds player-entered names, selected ruleset snapshot, match and event IDs, scores, and event history so a guest can play and resume on the same browser. The app sets a 12-hour local expiry after a save and removes an expired record when the app next reads it. Clearing browser site data removes the local copy sooner.                                                                                                                                                                                                                                                                                                       |
| Guest account and sync record | Supabase Auth and Postgres        | Supabase creates an anonymous account for a guest session. The server receives the match ID, anonymous owner ID, sport, ruleset ID, mode, score and court state, event IDs, sequence numbers, and timestamps. Guest payload sanitization removes player names and guest-only scoring configuration from the server match. The match becomes inaccessible 12 hours after the last accepted server activity, capped at 24 hours after creation. An hourly database job physically deletes expired matches and events. The anonymous Auth account is deleted after 30 days. These schedules depend on the Supabase Cron job succeeding. |
| Google-linked account         | Supabase Auth                     | Used for account history and Community Rules management. Supabase receives the identity attributes returned by Google for the OAuth scopes enabled in the project. Confirm the exact fields and scopes in the deployed provider settings before publication.                                                                                                                                                                                                                                                                                                                                                                         |
| Account match history         | Supabase Postgres                 | Stores match and event records under the account owner ID. Account matches do not receive the guest 12-hour expiry. The app has no self-service account deletion control. The database schema cascades match and Community Rule records when an Auth user is deleted, but the deletion request path must be decided and documented by the operator.                                                                                                                                                                                                                                                                                  |
| Community Rules               | Supabase Postgres                 | Stores the creator ID, sport, title, description, published status, scoring configuration versions, and timestamps. Published rules are readable without sign-in. After migrations `20261009120000_safe_community_rule_reads.sql` and `20261009130000_revoke_community_rule_table_reads.sql` are applied, client roles read rules through functions that return an explicit safe field list, while direct client reads of the underlying rule and version tables are revoked. Verify the deployed project's grants and API responses before publication.                                                                             |
| Community Rule reports        | Supabase Postgres                 | Stores the rule ID (cleared if the rule is permanently removed), report reason, optional details, timestamp, guest or account reporter ID, and optional reporter email. The email is used only for report follow-up. A report is manually reviewed; it does not automatically hide a rule. There is no automatic report-retention period, so reports remain until an operator removes them.                                                                                                                                                                                                                                          |
| Live Viewer link              | Browser URL and Supabase Postgres | The link contains a bearer token. Supabase stores a hash of the token, not the raw token. Anyone with a valid link can see the current score and court display until the owner revokes it or it expires, at most 12 hours after creation and no later than match expiry. Viewer reads do not extend the expiry. Treat the link as public after sharing.                                                                                                                                                                                                                                                                              |

## Service providers

- Vercel hosts the web application when deployed there.
- Supabase provides authentication, database storage, and Live Viewer access.
- Google provides sign-in when a user chooses Google authentication.
- hCaptcha may process a guest sign-in challenge if CAPTCHA protection is enabled. CAPTCHA is initially disabled; Supabase Auth IP-based rate limits and database action limits are used first. Enable CAPTCHA if abuse justifies the extra challenge.

This repository does not specify provider regions, provider log retention, or a final list of operational contacts. The operator must complete those details from the deployed project settings.

## User controls

- Guests can stop using the app and clear the site's browser data to remove local match data. This does not remove a server guest record before its expiry.
- Guests can link Google to claim still-valid matches, or sign out. Signing out does not delete match records.
- Owners can revoke a Live Viewer link. A viewer may already have copied or recorded information that was visible before revocation.
- A Community Rule creator can unpublish their rule. Unpublishing removes it from public discovery, but does not itself delete stored versions or reports.
- The app currently has no account deletion page. The operator must provide a contact and process before inviting the public to create accounts.

## Security and release notes

The browser uses Supabase's publishable key. The service-role key and any hCaptcha secret must remain in trusted server or dashboard configuration, never in the web bundle or repository.

Before publication, the operator should verify that the Community Rules and release-guardrail migrations have been applied, the hourly guest cleanup job is succeeding, and Auth rate limits match the runbook. Confirm provider regions, authentication scopes, report handling, and CAPTCHA settings. For an Indonesia-facing release, have a qualified reviewer assess this notice against applicable requirements, including the [Indonesian Personal Data Protection Law, Law No. 27 of 2022](https://peraturan.bpk.go.id/Details/229798/uu-no-27-).
