# V1.0 QA evidence — 2026-10-15

**Status: repository verification passed for the checks available on this host; this is not a production release sign-off.** The active Supabase project matches the repository migration history through `20261015101000_bound_match_journal_reads`. Disposable database tests, CI browser automation, real-device checks, provider configuration, legal approval, and owner approval remain open.

## Scope

This run covers the current working tree after the Tennis test synchronization fix, six-sport smoke coverage, responsive hint fix, route-title metadata, SEO entrypoints, and the existing account, sync, and Community Rules changes. No real player names or production data were used.

## Automated checks

| Check                                   | Result  | Evidence                                                                                                                                                                                        |
| --------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`                     | Pass    | Prettier check passed after formatting the updated HTML, evidence, and Playwright spec files.                                                                                                   |
| `git diff --check`                      | Pass    | No whitespace errors in the working-tree diff.                                                                                                                                                  |
| `pnpm typecheck`                        | Pass    | Scoring-core and web TypeScript checks passed after route-title message keys were added.                                                                                                        |
| `pnpm test`                             | Pass    | Scoring-core: 5 files, 68 tests. Web: 17 files, 124 tests.                                                                                                                                      |
| `pnpm test:coverage`                    | Pass    | Scoring-core statements 91.23%, branches 78.19%, functions 93.86%. Web statements 73.59%, branches 71.48%, functions 55.73%. Configured thresholds passed.                                      |
| `pnpm build`                            | Pass    | Scoring-core build, Vite production build, PWA service-worker generation, and static `/rules` plus `/id/rules` entrypoints passed.                                                              |
| Supabase migration history              | Pass    | Supabase project `skor lapangan` shows migrations through `20261015101000_bound_match_journal_reads`, matching the latest repository migration.                                                 |
| `pnpm exec playwright test --workers=1` | Pass    | Eight browser smoke tests passed: Badminton, Pickleball, Tennis, Padel, Table tennis reload, Squash service-box order, Community Rules directory, and unavailable viewer handling.              |
| Vercel production deployment            | Pass    | SEO deployment `dpl_4cdtRCxmLFEJ4DzYgENQxEMQ27rt` reached `READY`, aliased to `https://skor-lapangan.vercel.app`, and returned route-specific HTML for both public Community Rules directories. |
| `supabase test db`                      | Not run | Docker/Postgres is not available on this host. Run the pgTAP suite in a disposable database.                                                                                                    |
| Production dependency audit             | Not run | Registry/audit access is an external CI or release-environment check.                                                                                                                           |

## Changes verified in code

- Tennis unit/UI tests wait for lazy route content and scoring controls instead of assuming navigation completes synchronously.
- Playwright smoke coverage includes one setup, start, and point-entry path for each of the four previously uncovered sports.
- Static English and Indonesian metadata list all six supported sports.
- Setup, live match, viewer, and Community Rules routes set locale-aware document titles.
- Public homepages and Community Rules directories have route-specific canonical, description, `hreflang`, robots, Open Graph, Twitter, and structured-data metadata before JavaScript runs; utility and editor routes are marked `noindex`.
- The sitemap includes both public Community Rules directories, and both web manifests describe all six supported sports.
- Mobile sport hints wrap instead of hiding the distinctive rules summary behind an ellipsis.

## Manual browser checks

The local Chrome pass reached the home page, all six sport cards, Tennis mixed-doubles setup, live scoring, Community Rules, guest history/account states, and an invalid viewer route. The live scoreboard rendered score controls, undo/redo/correction controls, viewer panel, and portrait court layout. This does not replace sync, Live Viewer, OAuth, or real-device verification.

## Release gates still open

- Run the CI job, dependency audit, and disposable Supabase pgTAP tests. The local Playwright smoke suite passed with one worker.
- Verify the deployed RPC grants, RLS, cleanup Cron, and production-safe Community Rules reads. The migration history through `20261015101000_bound_match_journal_reads.sql` was confirmed in Supabase on 2026-10-15.
- Configure and smoke-test Vercel Preview variables, Google OAuth, account deletion, guest transfer, Live Viewer, and any hCaptcha policy.
- Submit the deployed sitemap in Google Search Console and request indexing for the English and Indonesian homepages plus Community Rules directories. Google indexing and ranking remain external outcomes, not code-level guarantees.
- Test narrow and large phone layouts on real devices, including brightness, keyboard, focus, rotation, and court-side readability.
- Replace legal and owner placeholders with approved operator identity, support/privacy contact, jurisdiction, effective dates, moderation policy, and retention wording before production publication.
