# QA evidence v1.0 — 2026-10-20

Environment: local release checkout `/Users/ptnep/Ngoding/skor-lapangan`, branch `release/v1-preview`, commit `359e64b`.

## Automated gates

| Check                | Result                                             |
| -------------------- | -------------------------------------------------- |
| `pnpm test`          | PASS — scoring-core 68 tests, web 143 tests        |
| `pnpm typecheck`     | PASS                                               |
| `pnpm build`         | PASS                                               |
| `pnpm format:check`  | PASS                                               |
| `pnpm test:coverage` | PASS — scoring-core lines 91.23%, web lines 74.03% |
| `pnpm test:e2e`      | PASS — 8 tests                                     |
| `git diff --check`   | PASS                                               |

## Release sequence

- Git commit `359e64b` pushed to `origin/release/v1-preview`; local and remote are synchronized.
- Supabase migration history is synchronized through `20261015120000_club_sessions`.
- `supabase db push --project-ref esuizdlgzcmsundzuhbq --yes` returned `Remote database is up to date` with no migrations pending.
- Vercel production deployment `dpl_5wySoBVvWrRNguknH4Dhv13kMXgP` reached `READY`.
- Production alias: <https://skor-lapangan.vercel.app>
- Authenticated production smoke check returned the expected application HTML.

## Remaining sign-off gates

This evidence does not replace disposable Supabase pgTAP execution, real-device/mobile checks, a club pilot, or owner/legal approval. See [legal-release-gate.md](legal-release-gate.md) and [club-session-plan.md](club-session-plan.md).
