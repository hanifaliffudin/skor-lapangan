# V1.0 implementation specification

## Product scope

V1.0 supports singles and doubles Badminton and Pickleball. Pickleball singles supports side-out and rally scoring, with side-out as the default. The product focuses on correct service rotation, score correction, reliable guest matches, and a shareable live score view. The preview code also contains Tennis, Padel, Table tennis, and Squash; each remains outside the V1.0 public scope until its own promotion gate passes.

The app remains mobile-first and English-default, with Indonesian available. The visual direction comes from `DESIGN.md`: outdoor readability, large tabular scores, cobalt for primary actions, lime for score/confirmation, portrait court layouts, and concise motion.

## Match storage and ownership

- A guest can start and control a match without signing in.
- The browser generates the match UUID and every event UUID. Retrying sync must not create duplicate matches or events.
- Guest scoring stays local-first. While online, the app syncs the match and event journal to Supabase under a Supabase anonymous-auth user. Offline events remain queued locally and retry with their original UUIDs.
- Match snapshot and event uploads are committed in one server transaction. A stale or divergent client snapshot must be rejected rather than overwriting a newer server state.
- Guest data remains available for 12 hours after the last server-accepted match activity, capped at 24 hours from creation. New accepted activity refreshes the inactivity expiry but cannot extend the hard cap. Expired records become inaccessible immediately and an hourly Supabase Cron job physically removes them and their events.
- The same browser can resume a guest match while its local owner session and server record are still valid. One tab controls a match at a time; other tabs are read-only.
- The V1.0 baseline does not require account sign-in. The staged account foundation adds persistent account history and guest-to-account claiming after its own foundation gate passes.
- Server-stored guest matches contain score and court state only. Player-entered names and guest-only rule configuration stay in the browser.
- A completed guest match can remain available to its Live Viewer until the guest match expires. Ending a match ends its guest-only custom rules immediately.

## Live Viewer

- The owner explicitly creates the viewer link by choosing Share. Viewers do not need an account.
- The link is a high-entropy bearer capability, separate from the match UUID. The database stores only a hash of the token.
- The viewer is read-only and shows score, court positions, and serving state. It does not expose player names, account identifiers, or editable match controls.
- The owner can revoke the link. Revocation and expiry must prevent future reads and broadcasts, not only hide the UI.
- The link expires within 12 hours of creation and no later than the match data. Viewer reads do not refresh expiry. Disconnected viewers see the last synced state and its update time.
- Live state must come from the server's canonical match row. Client broadcasts cannot change or be trusted as score state.

## Rules

### Official Rules

- Official rules remain locked and maintained by the product based on the relevant federation sources.
- Match format (`singles` or `doubles`) is stored separately from casual/referee mode. Missing format in legacy matches means doubles.
- Badminton singles uses rally scoring, best of three games, first to 21, win by two, capped at 30.
- Pickleball singles uses one server per side and score-parity service courts. Side-out scoring is the default; rally scoring can be selected. Both use best of three games, first to 11, win by two.
- Pickleball doubles keeps its two-server sequence and opening 0-0-2 exception.
- Table tennis is an official-only extension: singles and standard doubles, best-of-three or best-of-five games to 11 by two, ITTF service/receiver rotation, and deciding-game changes at five points. It does not add mixed doubles, custom rules, expedite, let/fault tracking, officiating, or referee workflow.
- Squash is an official-only extension: WSF singles 2025 and doubles 2022, singles PARS games to 11 by two, doubles games to 11 including 11–10, best-of-five by default with best-of-three available, service-box tracking, fixed doubles server order, and per-game receiver mapping. It does not add mixed doubles, custom rules, let/stroke/fault/appeal tracking, injury, officiating, or referee workflow.
- A match keeps the exact ruleset snapshot used when it began.

### Guest custom rules

- A guest can create custom rules for their current match only. The configuration stays in that browser, is not uploaded or published, and is discarded when the match completes.
- Customization in V1.0 is limited to scoring parameters supported by the Badminton and Pickleball engine. It does not add another sport or an arbitrary rule scripting system.

### Account foundation and deferred community features

- The V1.0 guest workflow remains the baseline release. The next staged account foundation adds configured OAuth sign-in, persistent account history, guest-to-account claiming, sign out, and in-app account deletion.
- Public Community Rules remain excluded until the separate moderation, legal, privacy, and security checks pass.

## Data integrity and access control

- Supabase Auth anonymous users own guest records until the OAuth account session is restored and the server-only transfer flow moves unexpired matches to the linked durable account. The account foundation uses the existing Auth identity and owner-scoped history; it does not add a profile table.
- RLS enforces ownership. The frontend never receives a service-role key.
- Event UUID and `(match_id, client_sequence)` uniqueness make retries idempotent and protect ordering.
- Guest expiry is checked in database read/write paths and viewer authorization. A cleanup job is for storage reclamation, not the security boundary.
- Database action limits reduce guest match, event, and viewer abuse. Supabase Auth's anonymous sign-in limit is configured separately; CAPTCHA remains a fallback if abuse warrants it.
- New V1 matches use the single Casual workflow. Referee is hidden until it has distinct behavior; historical matches retain their stored label.
- Supabase migrations and SQL policy tests are versioned in the repository. Applying migrations, enabling anonymous sign-ins, configuring the enabled OAuth providers, and deploying both server-only account functions are explicit release steps. Keep Community Rules disabled until their separate gate is approved.

## Implementation order

1. Add a versioned rules model and engine support for match-scoped guest custom rules, with unit tests for both sports and ruleset snapshots.
2. Replace tab-only guest storage with a 12-hour same-browser cache and anonymous Supabase sync. Preserve UUIDs across retries and add RLS, expiry, and cleanup migration tests.
3. Add owner-controlled Live Viewer link creation/revocation, an unauthenticated read-only route, expiry enforcement, and stale/offline states.
4. Add the account foundation behind local and Preview rollout gates while keeping Community Rules unavailable.
5. Update setup instructions and README for the staged account foundation.
6. Verify unit, type, build, database policy, deletion, mobile, and keyboard checks.

## Release checks

- Guest matches and every event retain their client UUID through refresh, tab recovery, offline retry, and duplicate submission.
- Guests can play both sports and use local custom rules; custom rules never reach Supabase and are removed when the match completes.
- Viewers without an account can see only the current public score state. Expired or revoked links cannot fetch further state.
- New V1.0 matches can use Official Rules or guest-only custom rules. Account history is available only through the staged account rollout; Community Rules remain unavailable in the interface.
- Mobile layout has no horizontal overflow, court orientation remains physical, all controls are keyboard-operable, and loading/empty/error/offline states are visible.
