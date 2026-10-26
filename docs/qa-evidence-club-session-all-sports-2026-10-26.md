# QA evidence: all-sport Club Sessions

**Date:** 2026-10-26
**Environment:** local checkout `/Users/ptnep/Ngoding/skor-lapangan`
**Status:** Local engineering checks updated after the write-guard and provider-neutral fixes. This is not a Preview or production release sign-off.

## Local engineering checks

- `pnpm format:check` passed.
- `git diff --check` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed: 71 scoring-core tests and 203 web tests.
- `pnpm test:coverage` passed: scoring-core 91.31% statements / 78.22% branches / 94.08% functions; web 74.71% statements / 73.63% branches / 62.67% functions.
- `pnpm build` passed.
- `pnpm test:e2e` passed: 12 browser tests passed and 3 tests were intentionally skipped because they require a configured server/auth or network-transition fixture.
- Targeted Club Session tests cover profile-aware queueing, singles assignment, Smart Rotation, management seams, and the table-tennis countdown.

## Disposable database verification

- The current tree contains 34 ordered migrations, including `20261026120000_club_session_write_guards.sql`.
- Historical migrations remain immutable; provider-neutral account gates are implemented by `20261026110000_global_auth_providers.sql`.
- The new write-guard migration adds active-player/court/profile validation, IANA time-zone validation, session freshness timestamps, and the transactional Smart Rotation queue RPC.
- `supabase db reset --no-seed` applied all 34 migrations to the local disposable database, followed by `supabase test db`: 18 pgTAP files and 186 tests passed, including RLS, grants, timezone validation, write guards, and the queue RPC.
- Preview migration history and deployed-environment verification were not run. No remote migration was applied.

## Browser and release gates

- Authenticated Preview checks for OAuth providers, CORS, RLS isolation, deletion, sync recovery, accessibility, and mobile use remain open.
- Club pilot, privacy/legal review, and owner approval remain open.
