# Skor Lapangan

A mobile-first scorekeeper for recreational Badminton and Pickleball doubles. It tracks the score, service turns, active server, and player positions during a match.

Version 1.0 focuses on these two sports so court visibility, score correction, and undo/redo can be tested with real players before more sports are added.

## Features

- Badminton doubles: rally scoring to 21, best of three games, win by two, capped at 30.
- Pickleball doubles: side-out scoring, best of three games, first to 11, win by two.
- Court view with the active server and current player positions.
- Undo, redo, and score override stored as match events.
- English by default, with Indonesian available from the language switch.
- Guest mode without an account. Match data lasts only while the tab remains open.
- Locked Official Rules with a versioned ruleset stored on each match.

## Tech stack

- React 19, TypeScript, Vite, and React Router.
- Vitest and Testing Library.
- A pnpm workspace with the scoring engine separated from the UI.

## Guest storage

The app stores match state in `sessionStorage` so scoring stays responsive while the tab is open. Closing the tab removes the match. The guest release does not make authentication or sync requests.

Each match and event still receives a browser-generated UUID. The repository retains the Supabase schema and idempotent sync foundation for a later account and match history phase, but the guest runtime does not load them.

## Run locally

```bash
pnpm install
pnpm dev
```

Verification commands:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Deploy to Vercel

Import the repository with its root directory unchanged. `vercel.json` runs the workspace build, publishes `apps/web/dist`, and rewrites browser routes to `index.html` so direct links and refreshes work.

## Project structure

```text
apps/web/                 React web app
packages/scoring-core/   Pure scoring engine and sport rules
supabase/migrations/     Schema, triggers, and RLS policies
supabase/tests/          Database policy tests
docs/                    ADRs, rules sources, and setup guides
```

## Release scope

Login, cross-device history, Community Rules, live sharing, and sports such as Tennis or Squash are outside the guest v1.0 scope. They can ship as separate updates after the first two sports prove the scoring foundation in real use.

The Supabase activation plan for the account phase is documented in [docs/supabase-setup.md](docs/supabase-setup.md).
