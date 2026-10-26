# ADR 0004: Provider-neutral durable account gates

## Status

Accepted

## Context

The original account-gated flows were written for Google OAuth. The application now supports a configured set of OAuth providers, so ownership actions must not depend on which provider a durable account used.

## Decision

Keep anonymous authentication for guest play. Require a non-anonymous durable Supabase account for guest-match claiming, guest-match transfer, account history, deletion, and Community Rules publishing. The frontend exposes only providers listed in `VITE_AUTH_PROVIDERS`, and the provider-neutral behavior is introduced through forward-only migrations without editing historical migrations.

## Consequences

- Each enabled provider must be configured in Supabase Auth and in the deployed redirect allow-list.
- Existing deployments receive the provider-neutral behavior through a new migration; historical migration files remain immutable.
- Provider-specific UI labels and errors must identify the selected provider, while durable-account errors remain provider-neutral.
