# V1.0 implementation specification

## Product scope

V1.0 supports doubles Badminton and Pickleball. The first public release focuses on correct service rotation, score correction, reliable guest matches, and a shareable live score view. Other sports remain separate follow-up releases.

The app remains mobile-first and English-default, with Indonesian available. The visual direction comes from `DESIGN.md`: outdoor readability, large tabular scores, cobalt for primary actions, lime for score/confirmation, portrait court with a horizontal net, and concise motion.

## Match storage and ownership

- A guest can start and control a match without Google sign-in.
- The browser generates the match UUID and every event UUID. Retrying sync must not create duplicate matches or events.
- Guest scoring stays local-first. While online, the app syncs the match and event journal to Supabase under a Supabase anonymous-auth user. Offline events remain queued locally and retry with their original UUIDs.
- Guest data remains available for 12 hours after the last server-accepted match activity, capped at 24 hours from creation. New accepted activity refreshes the inactivity expiry but cannot extend the hard cap. Expired records become inaccessible immediately and an hourly Supabase Cron job physically removes them and their events.
- The same browser can resume a guest match while its local owner session and server record are still valid. One tab controls a match at a time; other tabs are read-only.
- Google sign-in, persistent account history, and guest-to-account claiming are outside V1.0 and are planned for V1.1 after the foundation gate passes.
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
- V1.0 ships only the current Badminton and Pickleball doubles rulesets.
- A match keeps the exact ruleset snapshot used when it began.

### Guest custom rules

- A guest can create custom rules for their current match only. The configuration stays in that browser, is not uploaded or published, and is discarded when the match completes.
- Customization in V1.0 is limited to scoring parameters supported by the Badminton and Pickleball engine. It does not add another sport or an arbitrary rule scripting system.

### Deferred account and community features

- Google sign-in, persistent account history, guest-to-account claiming, and public Community Rules are excluded from V1.0.
- Plan these features for V1.1 after V1.0 scoring and sync defects are resolved, account deletion and support processes are ready, and Community Rules moderation and security checks pass.

## Data integrity and access control

- Supabase Auth anonymous users own guest records. Google identity and account history are not part of V1.0.
- RLS enforces ownership. The frontend never receives a service-role key.
- Event UUID and `(match_id, client_sequence)` uniqueness make retries idempotent and protect ordering.
- Guest expiry is checked in database read/write paths and viewer authorization. A cleanup job is for storage reclamation, not the security boundary.
- Database action limits reduce guest match, event, and viewer abuse. Supabase Auth's anonymous sign-in limit is configured separately; CAPTCHA remains a fallback if abuse warrants it.
- New V1 matches use the single Casual workflow. Referee is hidden until it has distinct behavior; historical matches retain their stored label.
- Supabase migrations and SQL policy tests are versioned in the repository. Applying migrations and enabling anonymous sign-ins are explicit V1.0 setup steps. Keep Google OAuth disabled until V1.1 is approved.

## Implementation order

1. Add a versioned rules model and engine support for match-scoped guest custom rules, with unit tests for both sports and ruleset snapshots.
2. Replace tab-only guest storage with a 12-hour same-browser cache and anonymous Supabase sync. Preserve UUIDs across retries and add RLS, expiry, and cleanup migration tests.
3. Add owner-controlled Live Viewer link creation/revocation, an unauthenticated read-only route, expiry enforcement, and stale/offline states.
4. Update setup instructions and README for the V1.0 guest-only scope.
5. Verify unit, type, build, and database policy checks, then complete a mobile and keyboard click-through.

## Release checks

- Guest matches and every event retain their client UUID through refresh, tab recovery, offline retry, and duplicate submission.
- Guests can play both sports and use local custom rules; custom rules never reach Supabase and are removed when the match completes.
- Viewers without an account can see only the current public score state. Expired or revoked links cannot fetch further state.
- New V1.0 matches can use Official Rules or guest-only custom rules. Community Rules and account history are not available in the V1.0 interface.
- Mobile layout has no horizontal overflow, court orientation remains physical, all controls are keyboard-operable, and loading/empty/error/offline states are visible.
