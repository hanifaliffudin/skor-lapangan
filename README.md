# Skor Lapangan

A mobile-first scorekeeper for Badminton, Pickleball, Tennis, and Padel. It tracks scores, service turns, the active server, and court positions for singles, doubles, and supported mixed-doubles formats.

V1.0 launched with Badminton and Pickleball. Tennis and Padel have separate federation-rule, database, regression, and mobile release checks. Padel doubles and mixed doubles follow FIP rules; club singles is a labeled local variant because FIP does not define singles.

## Features

- Badminton singles and doubles: rally scoring, best of three games, first to 21, win by two, capped at 30.
- Pickleball doubles: side-out scoring, best of three games, first to 11, win by two, including the opening 0-0-2 server exception.
- Pickleball singles: side-out scoring by default, with optional rally scoring; both are best of three games, first to 11, win by two.
- Tennis singles, standard doubles, and mixed doubles: event-announced best of 3 or 5 sets; advantage or no-ad games; tie-break or advantage sets, including the deciding set; and a 7- or 10-point final match tie-break by two. Defaults are best of 3, advantage games, and a tie-break at 6–6.
- Tennis doubles service and receiver orders are stored per set. Mixed-doubles role labels remain local to the controlling device and are not shared with Live Viewer.
- Padel doubles and mixed doubles: FIP Advantage, Star Point, or Golden Point games; standard or mini-sets; and standard, advantage, or 7-/10-point deciding-set match tie-break by two. Doubles uses a 10 × 20 m court. Club singles is a non-FIP, FIP-derived local variant on a 6 × 20 m court.
- Padel doubles service and deuce-court receiver orders are stored per set. Mixed-doubles role labels remain on the controlling device and are excluded from synced viewer data.
- A court view that shows current positions and the active server.
- Undo, redo, and one-event score overrides.
- Guest matches with client-generated UUIDs, local-first scoring, rate-limited server sync, and a 12-hour inactivity expiry capped at 24 hours. Expired records are cleaned hourly.
- Read-only Live Viewer links with revocation and a 12-hour maximum expiry, no later than the match data.
- Locked Official Rules and guest-only custom rules that stay in the current browser and match.
- One Casual match workflow in V1. Referee mode is hidden until it has meaningfully different behavior.
- English by default, with Indonesian available.

## Tech stack

- React 19, TypeScript, Vite, and React Router.
- Vitest and Testing Library.
- pnpm workspace with the scoring engine kept separate from the UI.
- Supabase Auth, Postgres, and Row Level Security for temporary guest sync and Live Viewer links.

## Run locally

```bash
pnpm install
pnpm dev
```

The app can run locally without Supabase, but server sync and Live Viewer links require the Supabase setup below. Google sign-in, account history, and Community Rules are deferred from V1.0. Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
```

The Supabase values and hCaptcha site key are public browser values. `VITE_HCAPTCHA_SITE_KEY` is only needed when CAPTCHA protection is enabled in Supabase. Never put a service-role key or hCaptcha secret in the frontend or repository.

Verification commands:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Supabase setup

Run the migrations in filename order using the Supabase SQL Editor. Apply `20261012130000_tennis_scoring.sql` before enabling Tennis clients and `20261012140000_padel_scoring.sql` before enabling Padel clients. Enable anonymous sign-ins for guest matches. Do not enable Google OAuth for the V1.0 release. The database migration set retains Community Rules schema needed by the release-guardrail migration, but the V1.0 app does not expose those features. See [docs/supabase-setup.md](docs/supabase-setup.md) for setup and verification steps.

## Deploy to Vercel

Import the repository with its root directory unchanged. `vercel.json` builds the pnpm workspace, publishes `apps/web/dist`, and rewrites browser routes to `index.html` so direct links and refreshes work. Add the `VITE_SUPABASE_*` values to Vercel before deployment if Supabase features should be enabled. Add `VITE_HCAPTCHA_SITE_KEY` only when CAPTCHA protection is enabled.

## Documentation

- [Product roadmap](docs/product-roadmap.md)
- [V1.0 implementation specification](docs/v1-implementation-spec.md)
- [Player guide](docs/user-guide.md)
- [QA and release checklist](docs/qa-release-checklist.md)
- [Operations runbook](docs/operations-runbook.md)
- [Official rules sources](docs/rules-sources.md)
- [Supabase setup](docs/supabase-setup.md)

Public-facing drafts that need owner and legal review before publication:

- [Privacy notice draft](docs/privacy-notice.md)
- [Terms of use draft](docs/terms-of-use.md)
- [Community Rules policy draft for V1.1](docs/community-rules-policy.md)
- [Account deletion request workflow draft for V1.1](docs/account-deletion-request-draft.md)

## Project structure

```text
apps/web/                 React web app
packages/scoring-core/    Pure scoring engine and sport rules
supabase/migrations/      Schema, triggers, and RLS policies
supabase/tests/           Database policy tests
docs/                     Product roadmap, implementation spec, ADRs, and setup guides
```
