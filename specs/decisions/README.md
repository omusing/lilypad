# Decision Records

This folder captures product, design, and architecture decisions that are not
obvious from the spec or code — decisions where the "why" matters as much as
the "what," where alternatives were seriously considered, or where the answer
is likely to be re-questioned later.

These are not ADRs in the strict software architecture sense. They cover any
decision that required deliberate reasoning: UX model choices, clinical design
choices, data model tradeoffs, privacy posture, etc.

---

## Format

Each record is a numbered Markdown file: `NNN-short-slug.md`

```
# NNN — Decision Title

**Status:** Decided | Revisit in V1.1 | Superseded by NNN
**Date:** YYYY-MM-DD

## Context

What question were we trying to answer? What situation or uncertainty prompted
the decision? Include the user or clinical context that makes this non-obvious.

## Options considered

### Option A — name
Description. Tradeoffs.

### Option B — name
Description. Tradeoffs.

## Decision

What we decided and why. One clear statement, then the reasoning.

## Consequences

What this decision rules out. What it defers. What it makes easier or harder.
What to watch for in V1.1+ that might prompt revisiting.
```

---

## Index

| # | Title | Status |
|---|-------|--------|
| [001](001-check-in-cadence.md) | Check-in cadence: pain diary vs. medication tracker | Partially superseded by 002 |
| [002](002-event-driven-logging.md) | Event-driven logging: replacing the BID data model | Decided |
| [003](003-versioning-and-migrations.md) | App versioning, DB schema versioning, and migration policy | Superseded by 006 |
| [004](004-medication-catalog-storage.md) | Medication catalog storage: TypeScript bundle vs. SQLite asset | Decided |
| [005](005-medication-catalog-build-order.md) | Medication catalog build order: hand-author first vs. pipeline first | Decided |
| [006](006-versioning-policy.md) | Versioning policy: migrations, testing, and release process | Active |
