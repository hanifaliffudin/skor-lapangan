# QA evidence v1.0, 2026-10-22

Environment: local release checkout `/Users/ptnep/Ngoding/skor-lapangan`, production preview at `http://127.0.0.1:4173`, Chrome via Playwright.

## Automated gates

| Check                            | Result                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm test`                      | PASS after fixing a date-sensitive legacy migration fixture, with 68 scoring-core tests and 169 web tests |
| `pnpm test:coverage`             | PASS, scoring-core lines 91.23%, web lines 73.21%                                                         |
| `pnpm typecheck`                 | PASS                                                                                                      |
| `pnpm build`                     | PASS, including the generated service worker with 39 precached entries                                    |
| `pnpm format:check`              | PASS                                                                                                      |
| `git diff --check`               | PASS                                                                                                      |
| Production preview browser suite | PASS, 12 tests passed and 1 opt-in server smoke skipped                                                   |
| Local Supabase pgTAP suite       | PASS, 18 files and 171 tests after local schema reset                                                     |

## Offline continuity evidence

- The cached application shell can start and score a Badminton match after the browser goes offline.
- An accepted score survives an offline reload through IndexedDB.
- The durable store is exercised by the Table tennis reload flow, including the absence of a legacy localStorage Match record after migration.
- Same-device offline Control remains single-writer across two tabs.
- A Match can finish offline, remain read-only as Pending sync, and reopen after navigation and reload.
- Viewer stale-state, PWA update deferral, storage migration, pending metadata, retry, conflict recovery, and local-to-new-Match recovery have component or unit coverage.
- Club Session management now reports its online requirement and blocks server mutations while offline. An already-linked local Match can still be opened on the device.

## Server-backed smoke status

The opt-in command below passed against the configured Supabase project:

```text
E2E_SERVER_SMOKE=1 E2E_BASE_URL=http://127.0.0.1:4173 pnpm exec playwright test tests/e2e/scoring.spec.ts --grep "syncs a guest match after reconnecting" --workers=1
```

The test passed in 9.4 seconds. It verified that a guest Match syncs while online, remains scoreable while offline, and returns to `synced` after connectivity is restored. The project keeps the anonymous-user limit at 10 requests per hour, which is suitable for production. Repeated automated runs should allow that window to reset between batches.

The local SQL migration and pgTAP suite passed after starting Docker and resetting the disposable database with `supabase db reset`, followed by `supabase test db`. The setup hook in `supabase/tests/000-setup-tests-hooks.sql` installs the documented test helpers, and `supabase/tests/zzzz-teardown-tests-hooks.sql` releases them before CLI cleanup. The remaining dashboard, OAuth, retention, real-device, mobile, and legal checks remain release sign-off work in [qa-release-checklist.md](qa-release-checklist.md).
