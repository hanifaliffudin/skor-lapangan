# Skor Lapangan: project overview

This is the entry point for people who need to understand the product, contribute code, or operate an environment. Read the sections that match your role, then follow the linked source documents for details.

## Five-minute summary

Skor Lapangan is a mobile-first scorekeeper for racket sports. A player can set up a singles or doubles match, enter points courtside, see service and court-position state, recover after a reload or temporary network outage, and share a read-only Live Viewer or TV display.

The product uses a local-first match journal. The browser accepts scoring actions and stores the journal locally before attempting server synchronization. Supabase provides authentication, database storage, access control, synchronization RPCs, account history, and read-only viewer access. Vercel serves the built web application.

The current repository contains three product layers:

1. The public scoring MVP for Badminton and Pickleball.
2. Preview capabilities for Tennis, Padel, Table tennis, Squash, account history, Community Rules, Display Mode, and offline continuity.
3. Badminton Club Sessions, including manual queueing, standings, and Smart Rotation for fair next-court assignments.

Preview code is not automatically a public-release approval. Each sport and account-backed feature has its own database, regression, mobile, privacy, and release gates.

## Read by role

### Stakeholder or product owner

Read in this order:

1. [Product roadmap](product-roadmap.md) for release scope and promotion gates.
2. [V1 implementation specification](v1-implementation-spec.md) for the product contract and privacy boundaries.
3. [Club Session plan](club-session-plan.md) for the organizer workflow and Smart Rotation status.
4. [QA and release checklist](qa-release-checklist.md) for what still needs evidence before promotion.
5. [Legal and owner release gate](legal-release-gate.md) before public publication.

### Junior developer

Read in this order:

1. [README](../README.md) for setup, commands, and the repository map.
2. This document through [Repository map](#repository-map) and [Common user journeys](#common-user-journeys).
3. [Web glossary](../apps/web/GLOSSARY.md) and [scoring glossary](../packages/scoring-core/GLOSSARY.md) before changing domain behavior.
4. [Local-first ADR](adr/0001-local-first-stack.md) and [atomic sync ADR](adr/0002-atomic-match-sync.md) before changing storage or synchronization.
5. The feature's tests before editing its implementation.

### Engineer or operator

Read in this order:

1. [Operations runbook](operations-runbook.md) for environments, migration order, deployment, rollback, and secrets.
2. [Supabase setup](supabase-setup.md) for Auth, migrations, Edge Functions, and verification.
3. The relevant ADR and feature specification.
4. [Latest QA evidence](qa-evidence-smart-rotation-2026-10-23.md) and the [release checklist](qa-release-checklist.md).

## Product boundaries

### What the application does

- Scores supported racket-sport formats and derives service, receiver, court-position, game, and match state.
- Keeps a match journal of the definition and ordered domain events.
- Stores an accepted score locally so a short network outage does not stop courtside scoring.
- Synchronizes signed-in or anonymous guest matches when the server path is available.
- Provides a token-scoped, read-only Live Viewer and a large Display Mode.
- Provides account history and a single-editor control lease for active account matches.
- Provides private organizer-owned Club Sessions for Badminton doubles open play.
- Provides versioned Community Rules behind authenticated owner and moderation boundaries.

### What the application does not promise

- It does not provide a referee or officiating workflow for every sport.
- It does not expose Club Session rosters or player metadata through Live Viewer or Display Mode.
- It does not make guest custom rules public or sync them as reusable rules.
- It does not provide public tournament brackets or multi-organizer Club Sessions in the current MVP.
- It does not treat a successful local build as proof that OAuth, production configuration, legal copy, or real-device behavior is ready.

## Architecture at a glance

```text
                         Vercel
                 static HTML, JS, CSS, PWA
                              |
                              v
Browser ------------------------------------------------------+
  React Router and feature pages                              |
  scoring-core: pure scoring and rules                       |
  match lifecycle: event append and derived state             |
  MatchStore: IndexedDB, with localStorage fallback           |
  PWA service worker and offline shell                        |
  auth, history, Club Session adapter, sync client             |
                              |                               |
                              | Supabase client + RPCs        | token-scoped reads
                              v                               v
                         Supabase                         Live Viewer
                 Auth, Postgres, RLS, RPCs,
                 Edge Functions, pg_cron
```

### Where each responsibility lives

| Area              | Primary location                                                                           | Responsibility                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Scoring rules     | `packages/scoring-core/src/`                                                               | Pure scoring state, domain events, ruleset snapshots, and sport-specific behavior.             |
| Match UI          | `apps/web/src/features/match/`                                                             | Setup handoff, score controls, court display, correction, undo/redo, and match recovery.       |
| Local persistence | `apps/web/src/lib/matchStore.ts` and `session.ts`                                          | Durable journal storage, schema validation, expiry metadata, and legacy migration.             |
| Synchronization   | `apps/web/src/lib/sync.ts` and `match-remote.ts`                                           | Serialize journals, call server RPCs, retry pending work, and surface stale/control conflicts. |
| Authentication    | `apps/web/src/lib/auth.tsx` and `supabase/functions/`                                      | Anonymous sessions, Google OAuth, guest transfer, account claiming, and account deletion.      |
| Club Sessions     | `apps/web/src/features/club-sessions/`                                                     | Roster, courts, queue, standings, Smart Rotation planning, and owner-scoped persistence.       |
| Public rules      | `apps/web/src/features/rules/` and Supabase RPCs                                           | Safe directory reads, owner mutation, versioning, publishing, and reports.                     |
| Database contract | `supabase/migrations/` and `apps/web/src/lib/database.types.ts`                            | Tables, constraints, RLS, RPCs, triggers, indexes, and generated client types.                 |
| Tests             | `apps/web/src/**/*.test.*`, `packages/scoring-core/test/`, `tests/e2e/`, `supabase/tests/` | Unit, component, browser, scoring, synchronization, RLS, and release-guardrail evidence.       |

## Common user journeys

### 1. Start and score a match

1. The user chooses a sport, format, ruleset, players, and opening server in `SetupPage`.
2. The app creates a match definition and an empty journal with a client-generated UUID.
3. `MatchPage` sends score actions to the scoring engine.
4. The engine appends a domain event and derives the current state from the journal.
5. `session.ts` persists the journal through `MatchStore`.
6. If the account and server path are available, `sync.ts` submits the definition and new events through `sync_match_journal`.
7. If the match is offline, the journal remains local and is marked pending for a later retry.

The scoring engine is the authority for derived score state. UI components should not implement a second scoring algorithm.

### 2. Recover after a network outage

1. The browser keeps accepting score actions while offline.
2. IndexedDB keeps the journal and sync metadata across reloads.
3. The app retries pending matches at startup, when the browser reports `online`, and when a match is reopened.
4. Supabase rejects stale or divergent snapshots instead of applying last-write-wins data.
5. The UI reports conflict, control-held, or failed states so an operator can decide what to do next.

See [Offline Match Continuity](specs/offline-match-continuity.md) and [ADR 0002](adr/0002-atomic-match-sync.md) before changing this path.

### 3. Open a match on another device

1. The signed-in account opens History and selects an active or completed match.
2. The client hydrates the match definition and bounded event chunks from Supabase.
3. An active match acquires a single-editor control lease.
4. A second device stays read-only until the lease is released or explicitly taken over.
5. The completed match remains readable without an active lease.

### 4. Share a Live Viewer or Display Mode

1. The owner creates a viewer capability for a match.
2. The app produces a token-scoped viewer URL.
3. Viewer reads expose score, service, court positions, and update state, but not entered player names or account identifiers.
4. The owner can revoke the capability. Expiry is enforced by the database, not only by the browser UI.
5. Display Mode uses the same read-only projection at a larger size for a TV or projector.

### 5. Run a Club Session

1. A signed-in organizer creates a private session.
2. The organizer adds players, gender metadata when relevant, availability, skill level, avoid preferences, and active courts.
3. The organizer can manually queue a four-player match or ask Smart Rotation to plan one match for each currently free court.
4. Smart Rotation prioritizes equal started/completed match counts, then wait time, pairing history, avoid preferences, and skill balance within the configured pairing mode.
5. The organizer reviews and confirms the proposal. A changed roster, court, queue, or result invalidates a stale proposal.
6. Results come from linked account Match journals. Club Sessions do not create a second score source.

See the [Smart Rotation specification](specs/club-session-smart-rotation.md) for the planner contract and acceptance criteria.

## Data and security model

### Match data

- The browser creates match and event UUIDs.
- The journal is ordered by client sequence and validated again by server-side constraints and RPCs.
- Guest records are temporary and have an inactivity expiry plus a creation-time cap.
- Account-owned records are protected by owner-scoped RLS and are removed through the account deletion workflow.

### Club Session data

- Sessions, players, courts, and planned matches are private to the owning account.
- Player names, gender, skill, availability, and avoid preferences are organizer data.
- A linked Match journal remains in account history when its Club Session is deleted.
- Club Session metadata is not copied into the Live Viewer projection.

### Secrets

The browser may receive the Supabase URL, publishable key, and optional hCaptcha site key. It must never receive the Supabase service-role key, Google OAuth secret, or hCaptcha secret. Server-only secrets belong in Supabase Edge Function or provider settings.

## Repository map

```text
apps/web/                  React + Vite application
  src/features/            User-facing workflows and route pages
  src/lib/                 Storage, sync, auth, Supabase, i18n, and shared helpers
  src/components/          Shared UI and app shell
packages/scoring-core/     Pure scoring engine and sport rules
supabase/migrations/       Forward-only schema, RLS, RPC, trigger, and index changes
supabase/functions/        Server-only account workflows
supabase/tests/            Disposable database pgTAP tests
tests/e2e/                 Playwright browser flows
docs/                      Product, architecture, operations, QA, legal, and feature specs
```

### Where to start a change

| Change                          | Start here                                               | Also update or verify                                                          |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Scoring or service rule         | `packages/scoring-core/src/`                             | Scoring tests, rules sources, setup UI, and Live Viewer state.                 |
| Score button or court display   | `apps/web/src/features/match/`                           | Match component tests and browser flow.                                        |
| Offline or persistence behavior | `apps/web/src/lib/matchStore.ts`, `session.ts`, `pwa.ts` | Offline tests, ADR 0001, and the offline specification.                        |
| Sync or multi-device control    | `apps/web/src/lib/sync.ts`, `match-remote.ts`            | Supabase RPC migration, pgTAP tests, ADR 0002, and conflict UI.                |
| Club Session behavior           | `apps/web/src/features/club-sessions/`                   | Smart Rotation spec, management/page tests, database migration, and RLS tests. |
| Database permission or schema   | `supabase/migrations/`                                   | `database.types.ts`, pgTAP, migration order, and setup/runbook docs.           |
| Public copy or privacy behavior | `docs/privacy-notice.md`, `docs/terms-of-use.md`         | Legal release gate and the deployed environment configuration.                 |

## Local development and verification

```bash
pnpm install
pnpm dev
```

The app can score locally without Supabase. Configure `apps/web/.env.local` when testing sync, account history, Live Viewer, Community Rules, or Club Sessions against a project.

Run the normal application checks:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm format:check
pnpm test:e2e
pnpm audit --prod
```

Run database tests only against the disposable local Supabase database:

```bash
supabase start
supabase db reset
supabase test db
supabase stop
```

Never point pgTAP tests at the active Preview or Production project. `supabase db push --project-ref ...` is for applying forward migrations to an authorized remote environment, not for running the local test suite.

## Release order

1. Run application, browser, dependency, and pgTAP checks.
2. Confirm the target Supabase migration history and apply only pending migrations in filename order.
3. Deploy the web app to Vercel Preview.
4. Run authenticated Preview checks, mobile and keyboard checks, and the feature pilot where applicable.
5. Record evidence and resolve privacy, security, moderation, legal, and owner gates.
6. Promote the verified Vercel deployment to Production.

Database migrations are forward-only. If a web release needs rollback, return to a compatible Vercel deployment without deleting or editing an applied migration.

## Documentation map

- [Product roadmap](product-roadmap.md): release sequence, scope, and promotion gates.
- [V1 implementation specification](v1-implementation-spec.md): original product and privacy contract.
- [Club Session plan](club-session-plan.md): session workflow and rollout status.
- [Smart Rotation specification](specs/club-session-smart-rotation.md): MVP decisions and acceptance criteria.
- [Offline continuity specification](specs/offline-match-continuity.md): offline stories and testing decisions.
- [Operations runbook](operations-runbook.md): deployment, migrations, rollback, Auth, cleanup, and troubleshooting.
- [Supabase setup](supabase-setup.md): environment configuration and verification.
- [QA release checklist](qa-release-checklist.md): release evidence and open gates.
- [Architecture decisions](adr/): decisions that should remain stable unless a new ADR replaces them.
- [Glossary map](../GLOSSARY-MAP.md): domain vocabulary by code context.

## Source-of-truth rules

- Product scope belongs in the roadmap and implementation/spec documents.
- User behavior belongs in the user guide and feature specifications.
- Domain terms belong in the context glossaries.
- Hard-to-reverse technical trade-offs belong in ADRs.
- Deployment and recovery procedures belong in the operations runbook.
- Test and release claims belong in dated QA evidence.

When two documents disagree, prefer the implementation and tests for current behavior, the latest dated QA evidence for verification status, and the operations runbook for environment procedures. Fix the conflicting document rather than copying the disagreement into a new page.
