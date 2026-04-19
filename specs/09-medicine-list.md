# Medication Catalog

The medication catalog is a bundled, offline-only list of common pain medications.
It powers autocomplete in the **Add Medication** form and has no other function in the app.

See [06-screens.md](06-screens.md) § "Add Medication sheet" for the UI that uses it.

---

## What It Is (and What It Is Not)

**It is:** compile-time app data. A TypeScript array bundled into the JS build alongside
the rest of the application code. Updated on every app release that includes a catalog
change. Never touches the network at runtime.

**It is not:**
- User data. The user's `medications` table in SQLite is the authoritative record of what
  medications they take, at what doses, and on what schedule. The catalog is never read
  after the user saves a medication.
- A live reference. After the user selects a drug from autocomplete and saves the form,
  the app does not look up the catalog again for that medication. The values saved in SQLite
  are exactly what the user had in the form at save time — brand name, dose string, route
  string. These persist as-is even if a later app release ships a different catalog.
- A replacement for the user's own knowledge. The catalog pre-fills fields as a convenience.
  The user can override every field.

---

## Data Shape

```typescript
// constants/medicationCatalog.ts

export type DrugClass =
  | 'NSAID'
  | 'Opioid'
  | 'Muscle Relaxant'
  | 'Anticonvulsant'
  | 'Adjuvant'
  | 'Combination'   // e.g. Ibuprofen + Diphenhydramine
  | 'Other';        // whitelist entries that don't fit a primary class

export interface MedCatalogEntry {
  rxcui:       string;      // RxNorm concept ID (stable across releases)
  genericName: string;      // lowercase: "ibuprofen"
  brandNames:  string[];    // title case: ["Advil", "Motrin IB"]
  strengths:   string[];    // ["200 mg", "400 mg", "600 mg", "800 mg"]
  routes:      string[];    // ["oral"] — first entry is the suggested default
  drugClass:   DrugClass;
}

export const MEDICATION_CATALOG: MedCatalogEntry[] = [ ... ];
```

**Constraints:**
- `rxcui` must be unique across all entries.
- `genericName` must be lowercase.
- `brandNames` must be title case.
- `strengths` must be non-empty.
- `routes` must be non-empty.

---

## How Autocomplete Works

The Add Medication form uses a custom search module (`lib/medSearch.ts`) to search
the catalog as the user types. No async calls. No SQLite lookups. The search index
is built once from the catalog array when the form mounts.

**Flat index with per-dose rows.** The index contains one row per (brand/generic name, strength)
combination. Typing "ibuprofen" returns rows like "Ibuprofen · 200 mg", "Ibuprofen · 400 mg",
"Ibuprofen · 600 mg", "Ibuprofen · 800 mg". Typing "advil" returns "Advil · 200 mg", etc.
This lets the user select the exact dose from the autocomplete in one tap.

**Scoring (in order of priority):**
1. Exact match (score 100)
2. Prefix match — query is a leading substring of the name (score 90)
3. Word-start match — query matches the start of any word in the name (score 75; "ibup" → "Ibuprofen")
4. Contains match (score 60)

Generic items rank before brand items on equal scores. Shorter names rank before longer names
on equal scores (so "Advil" ranks above "Advil Migraine" for the query "advil").

**Entry-time use only:**

1. User types in the Name field (≥ 2 characters triggers search).
2. Up to 5 suggestions appear below the field, each showing name · dose and a meta line
   (drug class for generics; "generic name · drug class" for brands).
3. User taps a suggestion. The form fills:
   - Name field ← the suggestion's display name (generic or brand)
   - Dose field ← the suggestion's strength (exact dose, already selected)
   - Route field ← the most patient-relevant route for this drug (`oral` preferred over `injectable`)
   - Frequency field ← left empty (user fills this)
4. Strength chips appear below the Dose field, showing all strengths for the selected drug.
   The tapped dose is pre-highlighted. User can tap a different chip to change dose.
5. Route chips appear below the Route field when the drug has multiple routes.
6. User edits any pre-filled field as they see fit.
7. User saves. The form values — whatever they are now — are written to SQLite as plain strings.

After save, the catalog plays no role. The `medications` row holds the user's own strings.

---

## SQLite Integration

When the user selects a catalog entry and saves a medication, the app writes one additional
field alongside the standard `name`, `dose`, `route`, `frequency`:

```sql
ALTER TABLE medications ADD COLUMN catalog_rxcui TEXT;
```

`catalog_rxcui` is:
- Populated when the user picks from autocomplete (`rxcui` of the selected entry).
- NULL when the user enters a medication by free text (no catalog match).
- Re-linked to the new entry's rxcui when the user explicitly re-selects a catalog
  entry while editing an existing medication. If the user edits the name, dose, or
  route fields without making a new catalog selection, `catalog_rxcui` retains its
  prior value.
- Never used for display. The Medications tab renders `name`, `dose`, `route` from SQLite directly.
- Reserved for future features: drug interaction warnings, catalog cross-referencing on export.

**Note on intent vs. accuracy:** `catalog_rxcui` captures what the user appeared to
intend — which catalog entry they most recently selected. If the user edits text
fields without re-selecting from autocomplete, `catalog_rxcui` may no longer match
the displayed data. This is expected and acceptable. The stored value is a best-effort
record of intent, not a live foreign key to the catalog. Future product versions may
surface mismatches to ask the user whether they want to re-link — but that is out of
scope for V1, and no code currently reads `catalog_rxcui` at all.

See [05-data-schema.md](05-data-schema.md) for the full `medications` table definition.

---

## Drug Classes in Scope

The catalog covers medications commonly prescribed or used for chronic pain management:

| Class | Examples |
|---|---|
| NSAID | Ibuprofen, Naproxen, Diclofenac, Celecoxib |
| Opioid | Tramadol, Oxycodone, Hydrocodone, Morphine, Codeine |
| Muscle Relaxant | Cyclobenzaprine, Baclofen, Methocarbamol, Tizanidine |
| Anticonvulsant | Gabapentin, Pregabalin, Carbamazepine, Lamotrigine |
| Adjuvant | Amitriptyline, Duloxetine, Venlafaxine (used off-label for pain) |
| Combination | Vicodin (Hydrocodone + Acetaminophen), Advil PM (Ibuprofen + Diphenhydramine) |
| Other | Acetaminophen, Topical agents (Lidocaine, Capsaicin) |

The catalog intentionally excludes:
- Medications with no established pain indication.
- Chemotherapy, immunosuppressants, diabetes medications, cardiovascular medications, etc.
  (unless they appear on the whitelist — see below).
- Investigational drugs not in RxNorm.

---

## Generated Catalog

`constants/medicationCatalog.ts` is generated by a Python script from public APIs.
The generation tool ships alongside V1 — the catalog is generated once before the
first app release and regenerated whenever the medication list needs updating.
No UI changes are required when the data file is updated.

### File Locations

```
maintenance/
  medicine-list-generator/
    src/
      update_medications.py      # Main pipeline script
      rxcui_classes.py           # Hand-curated seed: ingredient name → DrugClass
    test_medications.py          # pytest quality-gate tests
    medications_whitelist.json   # Force-include / manual combination entries
    medications_blacklist.json   # Force-exclude entries
    strength_whitelist.json      # Common clinical doses per RxCUI (overrides API strengths)
    requirements.txt
    setup.sh                     # Creates .venv and installs dependencies
    README.md

constants/
  medicationCatalog.ts           # Output — checked into git, committed on every update run
```

### Data Sources

| Source | What it provides | Access |
|---|---|---|
| [RxNorm REST API](https://rxnav.nlm.nih.gov/REST/) | Stable RxCUI per ingredient name | Free, no account |
| [OpenFDA NDC API](https://api.fda.gov/drug/ndc.json) | Brand names, strengths, routes per generic name | Free, no account |
| `src/rxcui_classes.py` | Drug class per ingredient name (seed) | Hand-maintained |

No file download required. Both APIs are queried at runtime (~80 HTTP requests,
~2 minutes). RxNorm bulk file downloads are avoided — they require UMLS license
agreement even for the prescribable subset.

### Brand Name Filtering (NDA filter)

Every NDC record returned by the OpenFDA API includes an `application_number` field:
- `NDA######` — FDA New Drug Application: innovator or brand-name drug (Advil, Tylenol, Motrin IB, Neurontin)
- `ANDA######` — Abbreviated NDA: generic drug, store-brand, or private-label product (CVS Ibuprofen, Equate, 365 Whole Foods Market)

The pipeline includes brand names **only from NDA records**. ANDA brand names are excluded regardless of market presence. This is the primary mechanism that keeps the autocomplete list clean across every regeneration.

After the NDA filter, brand names are also filtered by `_is_clean_brand()`:
- The brand name must not contain the generic ingredient name (filters "Ibuprofen 200 Mg" style entries)
- The brand name must be ≤ 4 words (filters product description strings)
- The brand name must not contain "And" (filters combination-product descriptions)

These rules are permanent in `update_medications.py` and apply to every catalog regeneration automatically.

### Strength Filtering

Raw OpenFDA strengths include specialty formulations irrelevant to outpatient pain management (neonatal IV doses, concentrated injectables, compounding quantities). Two mechanisms keep the strengths list clinically useful:

1. **NDA strengths + frequently-manufactured ANDA strengths.** The pipeline collects strengths from NDA records plus any ANDA strength that appears in ≥ 3 NDC records (indicating a commonly manufactured, clinically standard dose).

2. **`strength_whitelist.json` overrides.** For the most commonly searched medications, this file specifies the exact standard clinical dose list. When a drug's RxCUI appears in the whitelist, its strength list is replaced entirely — API-derived strengths are discarded. This guarantees ibuprofen shows `[200 mg, 400 mg, 600 mg, 800 mg]` rather than including neonatal or injectable doses.

To update a drug's strength list, edit `strength_whitelist.json` and re-run the pipeline. The format:

```json
[
  { "rxcui": "5640", "note": "ibuprofen — standard oral doses", "strengths": ["200 mg", "400 mg", "600 mg", "800 mg"] }
]
```

### Pipeline Steps

```
For each ingredient in src/rxcui_classes.py INGREDIENT_CLASSES:

1. Query RxNorm REST API for stable RXCUI by ingredient name
   GET rxnav.nlm.nih.gov/REST/rxcui.json?name={name}&search=1

2. Query OpenFDA NDC API for all NDC records matching that generic name
   GET api.fda.gov/drug/ndc.json?search=generic_name:"{name}"&limit=1000

3. Extract from NDC records, applying NDA filter:
   - brand_name from NDA records only → brandNames (title-cased, deduplicated, _is_clean_brand check)
   - active_ingredients[].strength → strengths (NDA-sourced + ANDA strengths with ≥3 records)
   - route[] → routes (mapped to canonical values: oral, topical, injectable, ...)

4. Apply strength_whitelist.json overrides (replace strengths for whitelisted RxCUIs)

5. Skip entry if no strengths or no routes found

6. Apply medications_whitelist.json: force-include entries + combinations (drug class override)
7. Apply medications_blacklist.json: remove entries by RXCUI
8. Validate output (see test criteria below)
9. Write constants/medicationCatalog.ts
```

### Whitelist / Blacklist / Strength Override Format

```json
// medications_whitelist.json
[
  {
    "rxcui": "123456",
    "reason": "Common off-label pain use, not classified as NSAID by OpenFDA",
    "drugClass": "Adjuvant"
  }
]

// medications_blacklist.json
[
  { "rxcui": "789012", "reason": "Recalled / not appropriate for this app" }
]

// strength_whitelist.json
[
  { "rxcui": "5640", "note": "ibuprofen — standard oral doses", "strengths": ["200 mg", "400 mg", "600 mg", "800 mg"] }
]
```

All three files are version-controlled in the repo alongside the script.
Changes to any file require a new script run + commit of the updated catalog.

### Test Criteria

Run `pytest test_medications.py` from `maintenance/medicine-list-generator/` before
committing the generated catalog. Tests are defined in `test_medications.py`.

Gates:
- Minimum 50 entries (roughly equal to seed size minus any API failures)
- No duplicate `rxcui` values
- No duplicate `genericName` values
- All required generics present: ibuprofen, acetaminophen, naproxen, tramadol,
  gabapentin, oxycodone, morphine, cyclobenzaprine, pregabalin, duloxetine,
  diclofenac, baclofen, amitriptyline
- Every entry has `rxcui`, `genericName`, `strengths`, `routes`, `drugClass`
- `drugClass` is one of the 7 valid values
- `genericName` is lowercase
- `brandNames` start with an uppercase letter
- `strengths` match `^\d+(\.\d+)? \S+$`
- `routes` are lowercase single words
- Entries are sorted by `genericName`
- Whitelist combination drugs (Vicodin, Percocet) are present

---

## App Maintenance

### When to regenerate

- Before each app release — picks up any brand name or strength changes in FDA data
- When a medication is reported missing by a user or clinician
- When a medication is reported inappropriate or recalled

### How to regenerate

```bash
cd maintenance/medicine-list-generator
source .venv/bin/activate              # or run ./setup.sh first if .venv missing
python src/update_medications.py       # queries RxNorm + OpenFDA, writes output
pytest test_medications.py             # must pass before committing
git add ../../constants/medicationCatalog.ts
git commit -m "catalog: regenerate YYYY-MM-DD"
```

`constants/medicationCatalog.ts` is checked into git — every update is an auditable diff.

### Adding a new single-ingredient medication

1. Add to `src/rxcui_classes.py` under `INGREDIENT_CLASSES`:
   ```python
   "drug name": "DrugClass",   # e.g. "milnacipran": "Adjuvant"
   ```
2. Run `python src/update_medications.py` — the script fetches RxCUI, brand names,
   strengths, and routes from the APIs automatically
3. Run tests, commit

### Adding a combination drug (whitelist)

Combination drugs (e.g. Vicodin) are not in the ingredient seed. Add them manually:

1. Find the RxCUI at [rxnav.nlm.nih.gov](https://rxnav.nlm.nih.gov/)
2. Add a full entry to `medications_whitelist.json`:
   ```json
   {
     "rxcui": "857005",
     "reason": "Vicodin — common hydrocodone/acetaminophen combination",
     "genericName": "hydrocodone / acetaminophen",
     "brandNames": ["Vicodin", "Norco"],
     "strengths": ["5 mg / 325 mg", "10 mg / 325 mg"],
     "routes": ["oral"],
     "drugClass": "Combination"
   }
   ```
3. Run `python src/update_medications.py`, run tests, commit

### Removing a medication (blacklist)

1. Find the RXCUI at [rxnav.nlm.nih.gov](https://rxnav.nlm.nih.gov/)
2. Add to `medications_blacklist.json`:
   ```json
   { "rxcui": "789012", "reason": "Recalled / not appropriate for this app" }
   ```
3. Run `python src/update_medications.py`, run tests, commit

---

## Spec References

- [06-screens.md § Add Medication sheet](06-screens.md) — UI behavior, form fields, autocomplete interaction
- [05-data-schema.md § medications table](05-data-schema.md) — `catalog_rxcui` column, SQLite schema
- [03-architecture.md](03-architecture.md) — build pipeline conventions
