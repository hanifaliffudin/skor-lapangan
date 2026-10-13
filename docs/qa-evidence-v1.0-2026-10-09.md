# V1.0 QA evidence — 2026-10-09

**Status: Partial local verification; not a production release sign-off.** This run covers the current working tree after deferring account history and Community Rules from V1.0. Supabase was not configured in the browser session.

## Automated checks

The root `pnpm test` command was attempted but stopped in pnpm's workspace preflight because it tried to refresh `node_modules` without an interactive terminal (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). The already-installed local executables were used directly for the equivalent checks:

| Check                              | Result | Evidence                                                                                            |
| ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Scoring-core build                 | Pass   | `packages/scoring-core`: `tsc -p tsconfig.build.json`, exit 0.                                      |
| Scoring-core tests                 | Pass   | Vitest: 1 file, 18 tests passed.                                                                    |
| Web tests                          | Pass   | Vitest: 9 files, 34 tests passed. Includes deferred `/rules` and `/history` routes and setup scope. |
| Scoring-core typecheck             | Pass   | `tsc --noEmit -p tsconfig.json`, exit 0.                                                            |
| Web typecheck and production build | Pass   | `tsc -b` and `vite build`, exit 0.                                                                  |
| Formatting and whitespace          | Pass   | `prettier --check .` and `git diff --check`, exit 0.                                                |

Vite emitted a bundle-size warning: the minified JavaScript bundle is 567.14 kB (168.22 kB gzip), above its 500 kB warning threshold. The build still completed successfully.

## Browser checks

Environment: local Vite app at `http://127.0.0.1:5173/`, Codex in-app browser, with blank Supabase configuration. Test matches were ended and removed after the checks.

| Area                                 | Result                  | Observed evidence                                                                                                                                                                      |
| ------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.0 setup scope                     | Pass                    | Setup offered Official Rules and guest custom rules. Community Rules were absent.                                                                                                      |
| Badminton score controls             | Pass                    | Started a synthetic doubles match, entered a point, used undo and redo, then overrode the score to 3–2. The displayed server state updated.                                            |
| Pickleball opening and side-out      | Pass                    | Keyboard selected Pickleball and continued setup. Opening state showed Player A1 on the right as Server 2; a Team B point changed service to Player B1, Server 1.                      |
| Keyboard focus                       | Pass                    | Tab navigation reached End session and showed a visible focus ring.                                                                                                                    |
| Narrow layouts                       | Pass                    | At 390×844 and 320×700, document width matched viewport width with no horizontal overflow. At 320 px, score controls remained visible and the smallest checked control was 44 px high. |
| Deferred routes and account controls | Pass in automated tests | App tests cover redirecting deferred routes and absence of Community Rules/account UI in the V1.0 flow.                                                                                |

## Production checks — 2026-10-12

Production deployment: `https://skor-lapangan.vercel.app/`. Vercel deployment `EC8iVmge7BrqcRYDs5JY8muBrdPC` reached `READY` after the remote build completed.

| Check                                  | Result  | Evidence                                                                                                                                          |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release tests                          | Pass    | Scoring core: 18 tests. Web: 34 tests. Total: 52 passed.                                                                                          |
| Production build and typecheck         | Pass    | Local build and forced TypeScript build passed. Vercel also built the production deployment.                                                      |
| English and Indonesian landing pages   | Pass    | `/` and `/id/` returned 200 with distinct language, title, description, canonical, and hreflang metadata.                                         |
| Google Tag Manager snippet             | Pass    | Container `GTM-WXQ5CHST` is present in both landing page documents. Tag firing and GA4 event receipt were not checked in Tag Assistant.           |
| Crawl files and ownership verification | Pass    | `robots.txt`, `sitemap.xml`, and `google1e47e11c0010212d.html` returned 200. The sitemap lists `/` and `/id/`.                                    |
| Deferred routes                        | Pass    | `/rules` and `/id/rules` redirect to their language homepages. `/setup` and `/match/*` return `X-Robots-Tag: noindex, nofollow`.                  |
| DNS ownership record                   | Pending | The supplied TXT value was not returned by a public DNS query. The HTML verification file and meta tag are available for URL-prefix verification. |

The production JavaScript bundle is 569.16 kB (169.20 kB gzip). Vite reports that it exceeds the 500 kB warning threshold; the deployment still built successfully.

## Current working tree verification — 2026-10-13

The web entry route now lazy-loads Home, Setup, Match, and Viewer. Authentication, QR generation, and hCaptcha are deferred until their routes or states need them. The current production build has a 294.47 kB entry JavaScript chunk (93.92 kB gzip) and emits no Vite chunk-size warning. Route and deferred chunks remain separately cacheable; Supabase client code is isolated from the initial entry.

Current local checks passed with `CI=true`: 53 scoring-core tests, 54 web tests, typecheck, production build, repository-wide Prettier check, and `git diff --check`. A Chrome smoke check also reached Home → Setup → Match, awarded a point, and opened and dismissed the end-match dialog on the local development route.

## Still required before public launch

- Run the SQL RLS and release-guardrail tests against a disposable Supabase database. Supabase CLI and Docker were unavailable in this environment, so no database test or migration was run.
- Apply the intended migrations in the target Supabase project; verify anonymous-auth rate limits, the hourly cleanup Cron job, and its successful run history.
- Run an authenticated server-sync and Live Viewer smoke test against a non-production Supabase project, including expiry and revocation.
- Check the Vercel environment variables needed by any Supabase-backed feature before enabling that feature. This deployment did not read or change environment variables.
- In Search Console, verify the URL-prefix property `https://skor-lapangan.vercel.app/`, submit `https://skor-lapangan.vercel.app/sitemap.xml`, and request indexing for `/` and `/id/`. The supplied TXT verification value was not visible in public DNS; the HTML file and meta tag are available.
- Use GTM Preview or Tag Assistant to confirm that the GA4 tag fires on both landing pages, then check that GA4 receives events.
- Complete the real-device court-side visibility check, including brightness and viewing distance.
- Fill and approve the privacy/contact placeholders, test the request mailbox, and obtain the required legal review before publication.
- Complete any remaining items in [the release checklist](qa-release-checklist.md); production smoke checks do not satisfy database or owner-approval gates.
