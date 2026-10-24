# Offline Match Continuity

## Status

Accepted

Skor Lapangan keeps Match scoring local-first for guests and signed-in users. A Match may be started, scored, completed, and recovered without a network connection; completed local results remain pending until the server accepts them. The app guarantees automatic retry when it is open or opened again, but does not require OS-level background sync while it is closed.

The offline store uses IndexedDB as the durable source for Match journals and pending sync work, while the service worker caches the application shell after the first successful load. Same-device tabs retain a single Control. Cross-device changes are not merged automatically: a Sync conflict preserves the local journal and lets the operator choose the server version or save the local version as a new Match. Match and event UUIDs remain stable across retries.

Live Viewer remains server-backed; when its connection is lost it may show the last known state as stale, but it must not present that state as live. Club Session management and other server-owned features remain unavailable offline in the first phase.

Guest Matches can use anonymous authentication when connectivity returns, while a later Google sign-in may claim an eligible Match. If durable local storage fails, scoring must fail safely instead of accepting a score that cannot be recovered. Active Matches remain local after sync for quick recovery; completed Matches may be cleaned up after successful sync. Service-worker updates must wait until scoring is no longer active.

## Consequences

- Offline completion is safe to perform, but the local result must not be discarded before successful sync.
- Retry can use exponential backoff while open, an immediate attempt on startup, and an explicit manual retry.
- Guest retention remains bounded by the existing policy; signed-in Match data remains available until sync or user deletion.
- Conflicts require an explicit operator decision instead of last-write-wins or event merging.
- A first offline visit still requires a previously cached application shell; server-owned features remain unavailable until connectivity returns.
- A storage-quota or persistence failure is visible to the operator and may temporarily block scoring.
