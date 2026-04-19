# 005 — Medication catalog build order: hand-author first vs. pipeline first

**Status:** Decided
**Date:** 2026-04-18

## Context

Once the decision to use a TypeScript bundle (see [004](004-medication-catalog-storage.md))
was made, a second question arose: in what order do we build the two components?

- **The data pipeline** — a script that downloads RxNorm and OpenFDA data, filters to
  pain drug classes, applies a whitelist/blacklist, and outputs `constants/medicationCatalog.ts`.
- **The UI** — autocomplete in the Add Medication form, Fuse.js fuzzy search, strength chips.

Both components depend on the TypeScript schema (`MedCatalogEntry`). The question was
which to build first.

## Options considered

### Option A — Build the pipeline first

Write `scripts/update_medications.py` before touching the UI. The catalog is
generated from real RxNorm data from day one. The UI is built against accurate data.

**Problems:**
- The pipeline requires downloading and parsing RxNorm RRF files, handling the
  OpenFDA join gap (only ~40% of entries have a usable `openfda.rxcui`), building
  the `rxcui_classes.py` seed for drug class assignment, and validating output.
  This is 1–2 days of work before a single line of UI exists.
- The schema might need to change once the UI is built. If the pipeline is already
  producing output against a V1 schema, a schema change means updating both the
  pipeline and the generated file.
- Effort spent on pipeline correctness before the UI exists is effort that may be
  partially wasted if the UX proves the approach doesn't work.

### Option B — Hand-author the catalog first, automate later (chosen)

Write ~200 entries in `constants/medicationCatalog.ts` by hand, sourced from the
OpenFDA drug label API (JSON, queryable in a browser). Build and ship the UI against
this hand-authored data. Replace the file with pipeline output in V1.1.

**Tradeoffs:**
- The hand-authored file is incomplete (~200 entries vs. potentially 500–1500 from
  the pipeline). Acceptable for V1 — the most common pain medications are covered.
- Manual maintenance until V1.1. Acceptable for a catalog that changes slowly.
- The schema is locked in by the time the pipeline is written, so the pipeline
  is built against a proven shape, not a speculative one.

## Decision

**Hand-author first (Option B), automate in V1.1.**

The schema is what matters at this stage, not the entry count. A working UI with
200 hand-authored entries ships faster and de-risks the UX before engineering
effort goes into the data pipeline.

The two components are cleanly separable: `constants/medicationCatalog.ts` is a
drop-in replacement. When V1.1 ships the pipeline, the UI requires zero changes.

## Consequences

- V1 ships with ~200 entries covering all 7 drug classes. Medications not in the
  catalog can still be added via free text — the catalog is a convenience, not a gate.
- The pipeline (V1.1) must produce output in the exact same TypeScript shape as the
  hand-authored file. The schema in `constants/medicationCatalog.ts` is the contract.
- The pipeline includes regression tests (`scripts/test_medications.py`) to verify
  minimum entry count, required drugs present, no blacklisted entries, correct field
  formatting. See [09-medicine-list.md](../09-medicine-list.md) for test criteria.
- If V1 user feedback reveals significant gaps in the 200-entry catalog (e.g., a
  drug class that is underrepresented), add those entries to the hand-authored file
  directly. Do not rush the pipeline to fix a coverage gap.
