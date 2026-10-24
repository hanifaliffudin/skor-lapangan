# Smart Rotation QA evidence — 2026-10-23 to 2026-10-24

Environment: local checkout `/Users/ptnep/Ngoding/skor-lapangan`, Supabase Preview project `esuizdlgzcmsundzuhbq`, local production build inspected in Chrome.

## Automated evidence

- `pnpm test` passed: scoring-core 68 tests and web 189 tests.
- `pnpm typecheck` passed.
- `pnpm build` passed. Vite retained the existing informational warning about a module that is both statically and dynamically imported; the build completed and generated the PWA service worker.
- `pnpm format:check` passed.
- `git diff --check` passed.
- Club Session coverage passed: 17 management tests and 7 page tests. Coverage includes fairness, occupied/free multi-court selection, late/resting/unavailable no-show handling, uneven Mixed rosters, proposal explanations, reject behavior, and stale-preview protection.

## Additional automated evidence — 2026-10-24

- `pnpm test:e2e` passed: 10 browser tests passed and 3 intentionally skipped because they require a configured server/auth or a network-transition fixture. Public rules, scoring, offline shell, offline recovery, multi-tab control, and completed-match recovery flows passed.
- `CI=true pnpm install --frozen-lockfile` passed.
- `pnpm audit --prod` initially identified nine vulnerabilities pulled through the build-time `shadcn` package. Moving `shadcn` from runtime dependencies to `devDependencies` removed it from the production graph; the follow-up audit passed with `No known vulnerabilities found`.
- After that dependency-scope fix, `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` passed again.
- `pnpm format:check` and `git diff --check` passed again after the final documentation audit.
- The first pgTAP attempt found Docker stopped and could not connect to `127.0.0.1:54322`. Docker was then started automatically, the local database was reset from repository migrations, and the final pgTAP run passed as recorded below.

## Supabase Preview and local database

- `supabase migration list --project-ref esuizdlgzcmsundzuhbq` initially reported `20261023150000` as pending.
- `supabase db push --project-ref esuizdlgzcmsundzuhbq --yes` applied `20261023150000_club_session_smart_rotation.sql` successfully.
- A second migration list reported local and remote `20261023150000` in sync.
- The local Supabase database was reset from the repository migrations, including `20261023150000_club_session_smart_rotation.sql`.
- `supabase test db` passed: all 18 pgTAP files and 177 tests passed, including the Club Sessions RLS, defaults, match attachment, and deletion-cascade checks.

## Chrome smoke check

- Opened the current local production build at `http://127.0.0.1:4173/sessions` in Chrome.
- Confirmed the Club Sessions page renders its title, description, private-account explanation, language control, and sign-in action without a console-visible failure.
- The authenticated roster, queue, Smart Rotation preview, mobile viewport, and keyboard pass remain manual Preview checks because this environment has no disposable Google account session to use.

## Remaining release gates

- Run [the Smart Rotation pilot](qa-smart-rotation-pilot.md) with a real club organizer and roster.
- Complete authenticated Preview RLS/deletion/sync and mobile/keyboard checks.
- Record privacy notice and owner approval before production promotion.
