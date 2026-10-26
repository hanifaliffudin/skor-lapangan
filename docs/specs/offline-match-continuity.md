# Offline Match Continuity

## Problem Statement

A Match is often scored courtside, where the network can be unreliable. The current local-first flow protects the live score during a temporary outage, but its durable storage and pending sync state are not strong enough for a Match that is completed offline, survives a browser restart, or needs explicit recovery after a conflict. Operators need confidence that a score accepted by the UI is recoverable and that reconnecting will not create duplicate Matches or events.

## Solution

Provide Offline Match Continuity for every sport and Match format already supported by the application. Guests and signed-in users can start, score, complete, and recover a Match without a network connection after the application shell has been cached. Match journals and pending sync metadata are stored durably in IndexedDB. When connectivity returns, the existing single-writer and atomic sync model retries automatically while the application is open, at application startup after auth is ready, and when the Match is reopened; it also offers an explicit manual retry.

Offline completion produces a read-only Match in Pending sync state. The local result is retained until the server accepts it. Conflicts are never merged automatically: the operator can use the server version or save the local version as a new Match. Live Viewer remains server-backed and may show its last known state as stale while disconnected. Server-owned features such as Club Session management remain unavailable offline in the first phase.

## User Stories

1. As a guest player, I want to start a new Match after the application has loaded once, so that I can begin scoring even when the network is unavailable.
2. As a signed-in player, I want to start a new Match offline, so that account authentication is not a prerequisite for scoring locally.
3. As a player, I want every accepted score change to survive a page refresh or browser restart, so that a temporary outage or accidental reload does not lose the Match journal.
4. As a player, I want the current score, service state, receiver state, court positions, corrections, undo, and redo to work offline, so that offline scoring behaves like connected scoring.
5. As a player, I want the UI to tell me when changes are only stored on this device, so that I do not mistake local persistence for server sync.
6. As a player, I want to complete a Match while offline, so that I can record the final result before leaving the court.
7. As a player, I want a completed offline Match to become read-only and remain available as Pending sync, so that I can safely close the app without discarding the result.
8. As a player, I want the application to retry sync automatically when connectivity returns while the app is open, so that normal reconnection does not require extra work.
9. As a player, I want the application to retry a pending Match when I reopen it, so that a Match does not depend on the app remaining open during the outage.
10. As a player, I want a manual retry action, so that I can recover from a transient server or network failure on demand.
11. As a player, I want retry attempts to preserve the original Match and event UUIDs, so that repeated attempts cannot create duplicate server records.
12. As a guest player, I want an offline Match to use anonymous authentication when connectivity returns, so that an eligible Match can sync without forcing me to sign in.
13. As a guest player, I want to sign in with Google after reconnecting and claim an eligible offline Match, so that I can retain it in account history.
14. As an account player, I want my active Match to remain available locally after a successful sync, so that I can recover quickly if the server is temporarily unavailable again.
15. As a player, I want a completed Match to be removed from local storage only after successful sync, so that cleanup cannot destroy the only recoverable copy.
16. As a player, I want guest retention rules to remain bounded, so that offline storage does not turn expired guest data into permanent data.
17. As a player, I want signed-in Match data to remain available until sync or explicit deletion, so that account history remains recoverable across sessions.
18. As a player using two tabs on one device, I want only one tab to hold Control, so that offline tabs cannot silently create divergent local scoring branches.
19. As a player using another device, I want the existing single-editor Control rules to continue applying after reconnecting, so that offline work does not overwrite another device without warning.
20. As a player facing a Sync conflict, I want to see that the local and server versions differ, so that I can make an informed recovery decision.
21. As a player facing a Sync conflict, I want to use the server version, so that I can discard a stale local branch deliberately.
22. As a player facing a Sync conflict, I want to save the local version as a new Match, so that valuable offline scoring is not lost when it cannot safely replace the server version.
23. As a Live Viewer, I want to see the last successfully received score when connectivity is lost, so that a brief outage does not blank the display.
24. As a Live Viewer, I want the display to say that the score is stale while disconnected, so that viewers do not believe the display is still live.
25. As an organizer, I want Club Session management to clearly report when it is unavailable offline, so that I do not mistake a local Match capability for offline session management.
26. As a player, I want a storage or quota failure to be visible before a score is accepted, so that the UI never claims to have saved a change that cannot be recovered.
27. As a player, I want a PWA update to wait until the active Match is no longer being scored, so that an application reload cannot interrupt scoring or pending sync.
28. As a player, I want the cached application shell and scoring assets to remain available offline after the first successful load, so that the feature works without a network request to render the scoring flow.
29. As a maintainer, I want legacy local Match records to be migrated when they are read, so that existing users do not lose Matches during the storage upgrade.
30. As a maintainer, I want the offline lifecycle to be testable without a real browser network, so that retry, conflict, completion, and recovery behavior can be regression-tested deterministically.

## Implementation Decisions

- Add a single durable Match Store interface that owns Match journals, sync metadata, pending completion state, retention metadata, and storage migration. React components must not know whether the backing store is IndexedDB or a legacy browser storage.
- Use IndexedDB as the primary durable store. Version the store schema and migrate existing localStorage Match records lazily when they are encountered. A failed migration must preserve the legacy record and surface a recoverable error.
- Persist enough sync metadata to resume after a browser restart, including the last accepted server sequence, pending event range, pending completion state, and the last known sync status. Do not rely on in-memory refs as the only record of pending work.
- Keep the existing append-only Match journal and stable client-generated Match/event UUIDs as the source of truth. The durable outbox may index or reference journal events, but must not invent a second scoring history.
- Extend the existing Match Lifecycle orchestration seam to coordinate local persistence, online detection, retry scheduling, completion, server hydration, Control, and conflict recovery.
- Preserve the atomic server sync contract. Sync retries must remain idempotent, send only the pending event range when possible, and treat stale, divergent, Control-held, and Control-lost responses as explicit recovery states.
- Use exponential backoff for repeated retry failures while the app is open. Trigger an immediate retry on the browser online event and when a pending Match is reopened. Keep a manual retry action visible for recoverable errors.
- Permit offline completion. Completion changes the local Match to read-only and Pending sync. The local record must not be removed until the final snapshot and pending events are accepted by the server.
- Keep the current retention policy: guest data remains bounded by the existing guest expiry rules; signed-in data remains until successful sync or explicit deletion. Pending sync data is not removed merely because it is pending.
- Keep single Control on the same device and across devices. Use the existing browser coordination and server lease behavior where available. An offline tab must not claim a second local editor for the same Match.
- Never merge conflicting journals automatically. Preserve both recovery inputs and let the operator choose the server version or create a new Match from the local journal. Any new Match must receive new identity metadata while retaining the local scoring result as its starting journal.
- Keep Live Viewer server-backed. When polling fails after a snapshot has been received, retain the last snapshot, mark it stale, and refresh immediately when connectivity returns. Do not make viewer writes or viewer creation available offline.
- Keep Club Session management, roster changes, court changes, queue changes, and other server-owned workflows unavailable offline in the first phase. The Match launched from an existing session may still use Offline Match Continuity, but the session board itself is not an offline write surface.
- Treat durable persistence as part of accepting a score. If IndexedDB cannot write the next journal state, do not advance the visible Match state; show an actionable storage error and allow retry after the storage issue is resolved.
- Keep the service worker application-shell cache behavior, and gate PWA update activation while a Match is actively scoring or has pending sync work. Prompt for the update after the Match reaches a safe state.
- Use anonymous authentication for eligible guest sync after connectivity returns. Preserve the existing OAuth sign-in claim flow for eligible local Matches.
- Keep server-owned history as the long-term recovery source after a signed-in Match has synced. Active signed-in Matches may remain locally cached for quick resume; completed synced records may be cleaned up locally.

## Testing Decisions

- Tests must assert external behavior and recovery outcomes, not IndexedDB implementation details or internal React state shape.
- Add Match Store contract tests covering create/read/update/delete, schema versioning, localStorage migration, durable sync metadata, retention, quota/persistence failure, and concurrent access expectations.
- Extend Match Lifecycle tests to cover offline scoring persistence, reconnect retry, startup retry, exponential backoff, pending completion, successful cleanup, retry idempotency, Control loss, stale server snapshots, conflict recovery, and local-to-new-Match recovery.
- Preserve and extend existing scoring-core tests to prove that all supported sports continue to derive the same Match state when the journal is replayed after offline persistence and reload.
- Add component tests for offline, pending sync, stale viewer, conflict, storage error, and deferred update messaging. Reuse existing page tests and adapter-based lifecycle tests wherever possible.
- Add browser end-to-end coverage for: first online load then offline start; offline score and reload; offline completion and reopen; reconnect sync; duplicate-safe retries; two-tab Control; conflict recovery; viewer stale state; PWA update deferral; and server-only Club Session behavior while offline.
- Run migration and compatibility tests against existing localStorage-shaped records and current server journal payloads. Verify that a failed migration never silently deletes the legacy record.
- Use deterministic fake clocks, network toggles, and retry schedulers in unit tests. Do not make tests depend on real network timing or a specific browser's undocumented Background Sync behavior.

## Out of Scope

- Guaranteed OS-level Background Sync while the application is closed.
- Offline creation or editing of Club Sessions, rosters, courts, queue entries, or session standings.
- Offline creation, revocation, or server refresh of Live Viewer links.
- Automatic merge of local and server journals.
- Multi-editor offline collaboration across devices.
- A new cross-session player identity or player-statistics model.
- Export to image, PDF, or CSV.
- Quick rematch.
- Changing the existing guest retention policy or server sync protocol beyond what is required to persist and resume pending work.
- Encrypting browser storage with a new application-managed key scheme.

## Further Notes

- The feature should be delivered as a sequence of vertical slices: durable store and migration, pending sync metadata, lifecycle retry and completion, conflict recovery, viewer stale state, PWA update gating, and browser-level verification.
- The initial rollout should be feature-flagged or released behind a controlled preview if the existing localStorage migration cannot be verified against representative records.
- The existing single-writer and atomic sync ADRs remain authoritative. This spec adds durable local continuity; it does not change server ownership or conflict semantics.
- Observability should record aggregate sync outcomes and failure categories without adding player names or journal contents to analytics.
