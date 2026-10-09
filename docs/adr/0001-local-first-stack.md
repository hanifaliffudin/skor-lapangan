# ADR 0001: Local-first foundation

## Status

Accepted

## Decision

Use React, strict TypeScript, Vite, and a UI-independent scoring package. Generate match and event UUIDs in the browser. Keep scoring responsive and persist guest journals in browser storage while syncing accepted activity to Supabase under anonymous authentication.

## Rationale

The scoring engine can be tested without a browser, guest scoring survives temporary network loss, and retries retain the same record identities. Supabase provides short-lived cross-tab/server continuity and read-only viewer access without requiring Google sign-in to start a match.

## Consequences

- Guest journals are kept locally for up to 12 hours after local activity; server guest records expire 12 hours after the last accepted server activity, capped at 24 hours from creation. An hourly database job physically removes expired rows.
- Server guest actions are rate-limited. CAPTCHA remains an adaptive fallback if abuse appears.
- A client-generated UUID is the idempotency key for every match and event.
- Google OAuth is optional for guest play, but needed for account history and Community Rules publishing.
- The frontend uses only Supabase's publishable key. Row Level Security and restricted RPC functions enforce access.
