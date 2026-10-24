# Skor Lapangan

A mobile-first scorekeeper for Badminton, Pickleball, Tennis, Padel, Table tennis, and Squash. It tracks scores, service turns, the active server, receivers, and court positions for singles, doubles, and supported mixed-doubles formats.

V1.0 launched with Badminton and Pickleball. The preview also contains Tennis, Padel, Table tennis, and Squash, each with separate federation-rule, database, regression, and mobile promotion checks. Padel doubles and mixed doubles follow FIP rules; club singles is a labeled local variant because FIP does not define singles.

## Features

- Badminton singles and doubles: rally scoring, best of three games, first to 21, win by two, capped at 30.
- Pickleball doubles: side-out scoring, best of three games, first to 11, win by two, including the opening 0-0-2 server exception.
- Pickleball singles: side-out scoring by default, with optional rally scoring; both are best of three games, first to 11, win by two.
- Tennis singles, standard doubles, and mixed doubles: event-announced best of 3 or 5 sets; advantage or no-ad games; tie-break or advantage sets, including the deciding set; and a 7- or 10-point final match tie-break by two. Defaults are best of 3, advantage games, and a tie-break at 6–6.
- Tennis doubles service and receiver orders are stored per set. Mixed-doubles role labels remain local to the controlling device and are not shared with Live Viewer.
- Padel doubles and mixed doubles: FIP Advantage, Star Point, or Golden Point games; standard or mini-sets; and standard, advantage, or 7-/10-point deciding-set match tie-break by two. Doubles uses a 10 × 20 m court. Club singles is a non-FIP, FIP-derived local variant on a 6 × 20 m court.
- Padel doubles service and deuce-court receiver orders are stored per set. Mixed-doubles role labels remain on the controlling device and are excluded from synced viewer data.
- Table tennis singles and doubles: ITTF 2022 games to 11, win by two, best of three or five, two-point service rotation changing to one-point rotation at 10–10, doubles server/receiver rotation, and deciding-game side and receiving-order changes at five points.
- Table tennis setup stores the first server and, for doubles, the first receiver. Later game order confirmation is required for doubles; the server and receiver markers are shown on a responsive portrait table with a horizontal net.
- Squash singles and doubles: WSF 2025/2022 PARS rally scoring, best-of-five by default with best-of-three available, server/receiver order, service-box selection, and a responsive court with front wall, tin, service line, short line, half-court line, and service boxes.
- Squash doubles keeps a fixed server order and lets each pair confirm its left/right receiver mapping before the next game. Let, stroke, fault, appeal, injury, and referee calls remain outside the scorekeeper scope.
- A court view that shows current positions and the active server.
- Undo, redo, and one-event score overrides.
- Guest matches with client-generated UUIDs, local-first scoring, rate-limited atomic server sync, and a 12-hour inactivity expiry capped at 24 hours. Stale or divergent snapshots are rejected; expired records are cleaned hourly.
- Google account history that can hydrate active or completed matches on another browser or device. Active matches use a single-editor lease with explicit takeover; other devices stay read-only until they acquire control.
- Read-only Live Viewer links with revocation and a 12-hour maximum expiry, no later than the match data.
- Club Sessions for organizer-owned badminton open play: player/court roster, manual queueing, Smart Rotation for fair next-court assignments, and ranked standings.
- A large TV/projector Display Mode opened from the scorekeeper screen, while the scorekeeper keeps control from a phone and Live Viewer stays read-only.
- Durable PWA offline scoring in IndexedDB, with pending match sync retried at startup, on reconnect, and when a match is reopened.
- Locked Official Rules, published Community Rules, and guest-only custom rules. Community Rules are versioned and snapshotted into each match.
- One Casual match workflow in V1. Referee mode is hidden until it has meaningfully different behavior.
- English by default, with Indonesian available.

## Tech stack

- React 19, TypeScript, Vite, and React Router.
- Vitest and Testing Library.
- pnpm workspace with the scoring engine kept separate from the UI.
- Supabase Auth, Postgres, and Row Level Security for guest sync, account match history, single-editor control leases, and Live Viewer links.

## Run locally

```bash
pnpm install
pnpm dev
```

The app can run locally without Supabase, but server sync, Google account features, Live Viewer links, and Community Rules require the Supabase setup below. Community Rules should be rolled out to Preview first with a disposable Google account and anonymous session. Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

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
pnpm format:check
git diff --check
pnpm test:coverage
pnpm test:e2e
```

## Supabase setup

Run all twenty-eight migrations in filename order using the Supabase SQL Editor or `supabase db push`. Apply the bounded journal reader and event-integrity migrations before deploying the matching frontend. Apply the Club Sessions and Smart Rotation migrations before deploying that feature. Enable anonymous sign-ins, Google OAuth, and deploy the server-only `delete-account` and `transfer-guest-matches` Edge Functions. Complete the moderation, contact, security, and legal gates in Preview before Production. See [docs/supabase-setup.md](docs/supabase-setup.md) and [docs/operations-runbook.md](docs/operations-runbook.md) for setup and verification steps.

## Deploy to Vercel

Import the repository with its root directory unchanged. `vercel.json` builds the pnpm workspace, publishes `apps/web/dist`, and rewrites browser routes to `index.html` so direct links and refreshes work. Add the `VITE_SUPABASE_*` values to Vercel before deployment if Supabase features should be enabled. Add `VITE_HCAPTCHA_SITE_KEY` only when CAPTCHA protection is enabled.

## Documentation

- [Changelog](CHANGELOG.md)
- [Product roadmap](docs/product-roadmap.md)
- [V1.0 implementation specification](docs/v1-implementation-spec.md)
- [Player guide](docs/user-guide.md)
- [QA and release checklist](docs/qa-release-checklist.md)
- [Latest QA evidence](docs/qa-evidence-v1.0-2026-10-15.md)
- [Operations runbook](docs/operations-runbook.md)
- [Official rules sources](docs/rules-sources.md)
- [Supabase setup](docs/supabase-setup.md)
- [Architecture decisions](docs/adr/0001-local-first-stack.md) and [atomic sync ADR](docs/adr/0002-atomic-match-sync.md)
- [Legal and owner release gate](docs/legal-release-gate.md)

Public-facing drafts that need owner and legal review before publication:

- [Privacy notice draft](docs/privacy-notice.md)
- [Terms of use draft](docs/terms-of-use.md)
- [Community Rules policy and moderation runbook](docs/community-rules-policy.md)
- [Account deletion workflow](docs/account-deletion-request-draft.md)

## Project structure

```text
apps/web/                 React web app
packages/scoring-core/    Pure scoring engine and sport rules
supabase/migrations/      Schema, triggers, and RLS policies
supabase/tests/           Database policy tests
docs/                     Product roadmap, implementation spec, ADRs, and setup guides
```
