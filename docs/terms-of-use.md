# Terms of use

**Status: Draft for owner and legal review. Do not publish or treat this as final terms.**

The owner must complete the bracketed fields, decide the open product terms, and obtain appropriate legal review before asking users to accept this document.

- Service operator: `[OWNER LEGAL NAME]`
- Contact: `[SUPPORT OR LEGAL CONTACT EMAIL]`
- Service region and governing jurisdiction: `[OWNER TO DECIDE]`
- Effective date: `[DATE OF PUBLICATION]`

## 1. What the service does

Skor Lapangan provides a browser-based scorekeeper for Badminton, Pickleball, Tennis, Padel, Table tennis, and Squash in supported singles and doubles formats. Pickleball singles offers side-out or rally scoring. It records scores, service and court positions, and may sync match state or display it through a Live Viewer when server features are configured.

The service is a scorekeeping aid. It is not a referee, a federation service, or a substitute for the rules and decisions of an organizer or match official. Players should verify the applicable rules before play, especially for organized competition.

## 2. Rules and scoring

Official Rules in the app are based on the sources listed in [rules-sources.md](rules-sources.md). Federations may update their rules, and the app may not reflect a change immediately. Each match uses the ruleset selected when that match starts.

The public V1.0 release supports Official Rules and guest custom rules for the current match. The current local and Preview build also exposes Community Rules for browsing, publishing, and reports; those features remain gated from production until moderation, security, privacy, contact, and legal checks are approved. Google account linking, account history, and account deletion are being rolled out through local and Preview checks before production promotion.

## 3. Guest matches and accounts

Guests can play without an account. Local match data is stored in the browser. When server sync is enabled, a guest match becomes inaccessible after 12 hours without accepted server activity, capped at 24 hours after creation. The hourly cleanup job physically deletes expired match and event data, and deletes anonymous Auth records after 30 days. A failed or paused cleanup job can delay physical deletion but does not restore access to expired records.

Guests may link the current anonymous session to Google. This preserves eligible guest matches and makes them available in account history. Account history is scoped by Supabase row-level security and can be reopened on another browser or device. An active match has one editor at a time; another device is read-only until the user explicitly takes over, while completed matches are read-only. A Google-linked user can sign out, and can permanently delete the account from `/account`; deletion removes the account's match data, related events, reports, user-created rules and versions if present, associated viewer capabilities, local match journals, and the Auth user. Community Rules are available only in the staged local/Preview rollout and remain subject to the production gate described above.

## 4. Live Viewer links

An owner may create a read-only Live Viewer link. Anyone with the link can view its score and court display until the link expires (within 12 hours and no later than match expiry) or the owner revokes it. Viewing does not extend the expiry. Owners are responsible for choosing where to share a link. Revocation stops future access, but it cannot remove screenshots or information a viewer saved earlier.

## 5. Match conduct

Guest custom rules apply to the current match only and stay in the browser. They are not published or shared by the service.

## 6. Acceptable use

Do not use the service to interfere with another user's match, attempt unauthorized access, or use a Live Viewer link to expose information without the match owner's permission.

## 7. Availability and support

The service depends on the user's browser, network connection, hosting provider, and Supabase configuration. A local match can continue without Supabase, but server sync and Live Viewer access require the relevant server configuration.

The operator must add a support contact and describe how users can request help before publication. The service currently has no published support response time.

## 8. Fees and changes

The current app has no payment or subscription flow. If the operator adds paid features, the operator must publish updated terms before enabling them.

The operator should publish a new effective date when these terms change and should identify how existing users will be notified. The implementation of that notice is not part of the current app.

## 9. Items requiring review before publication

- Operator identity, address, support and privacy contacts.
- Applicable jurisdictions and any required age or parental-consent policy.
- Privacy notice and a contact for privacy requests.
- Any warranty, liability, dispute, or termination terms appropriate to the service and applicable law.

The account foundation requires an approved privacy notice, terms, deletion workflow, server-only Edge Function, and local/Preview smoke test before production promotion. Community Rules still require a separate license, report handling, moderation, and appeal process before enabling those features.

For an Indonesia-facing release, have a qualified reviewer assess the final terms in context. The official [Indonesian Personal Data Protection Law, Law No. 27 of 2022](https://peraturan.bpk.go.id/Details/229798/uu-no-27-) is one source for privacy review; this draft does not claim compliance with it or any other law.
