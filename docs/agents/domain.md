# Domain Docs

This repository uses a multi-context domain layout.

## Before exploring

1. Read `GLOSSARY-MAP.md`.
2. Read the glossary for the context being explored.
3. Read relevant repository-wide ADRs in `docs/adr/`.
4. Check for context-specific ADRs alongside that context.

If a context glossary does not exist yet, proceed with the vocabulary already present in the code. The domain-modeling workflow creates glossaries lazily when terms are resolved.

## Contexts

- `apps/web/GLOSSARY.md`: user-facing workflows such as Match, Club Session, setup, history, and Ruleset selection.
- `packages/scoring-core/GLOSSARY.md`: scoring behavior, Match Journal, domain events, and sport rules.
- `docs/adr/`: repository-wide architectural decisions.

Use glossary terms in issue titles, refactor proposals, and tests. Flag any proposal that conflicts with an ADR.
