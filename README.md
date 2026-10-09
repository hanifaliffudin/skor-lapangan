# Skor Lapangan

A mobile-first scorekeeper for recreational Badminton and Pickleball doubles. It tracks points, service turns, the active server, and player positions on court.

V1.0 launches with these two sports. The focus is reliable scoring, quick correction, and a court view players can read during a game. More sports can follow as separate releases.

## Features

- Badminton doubles: rally scoring, best of three games, first to 21, win by two, capped at 30.
- Pickleball doubles: side-out scoring, best of three games, first to 11, win by two, including the opening 0-0-2 server exception.
- A court view that shows current positions and the active server.
- Undo, redo, and one-event score overrides.
- Guest matches with client-generated UUIDs, local-first scoring, rate-limited server sync, and a 12-hour inactivity expiry capped at 24 hours. Expired records are cleaned hourly.
- Read-only Live Viewer links with revocation and a 12-hour maximum expiry, no later than the match data.
- Locked Official Rules and public, versioned Community Rules. Community Rules are unofficial, published without pre-approval, and manually reviewed after reports.
- One Casual match workflow in V1. Referee mode is hidden until it has meaningfully different behavior.
- English by default, with Indonesian available.

## Tech stack

- React 19, TypeScript, Vite, and React Router.
- Vitest and Testing Library.
- pnpm workspace with the scoring engine kept separate from the UI.
- Supabase Auth, Postgres, and Row Level Security for temporary guest sync, account history, Live Viewer links, and Community Rules.

## Run locally

```bash
pnpm install
pnpm dev
```

The app can run locally without Supabase, but server sync, Live Viewer links, account history, and Community Rules require the Supabase setup below. Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

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

Run the migrations in filename order using the Supabase SQL Editor. Enable anonymous sign-ins for guest matches. Google OAuth is optional for guest scoring; it is required for persistent account history and to create or manage Community Rules. See [docs/supabase-setup.md](docs/supabase-setup.md) for dashboard setup and verification steps.

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
- [Community Rules policy draft](docs/community-rules-policy.md)

## Project structure

```text
apps/web/                 React web app
packages/scoring-core/    Pure scoring engine and sport rules
supabase/migrations/      Schema, triggers, and RLS policies
supabase/tests/           Database policy tests
docs/                     Product roadmap, implementation spec, ADRs, and setup guides
```
