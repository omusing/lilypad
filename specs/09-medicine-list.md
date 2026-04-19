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

The Add Medication form uses [Fuse.js](https://fusejs.io/) to search `genericName` and
`brandNames` across the catalog as the user types. No async calls. No SQLite lookups.
The catalog array is loaded once into a Fuse index when the form mounts.

**Entry-time use only:**

1. User types in the Name field.
2. Fuse returns up to 5 matches, shown as a suggestion list below the field.
3. User taps a suggestion. The form fills:
   - Name field ← selected brand name (or generic name if no brand)
   - Dose field ← pre-filled with `strengths[0]` as starting point
   - Route field ← pre-filled with `routes[0]` as starting point
   - Frequency field ← left empty (user fills this)
4. User edits any pre-filled field as they see fit.
5. User saves. The form values — whatever they are now — are written to SQLite as plain strings.

After save, the catalog plays no role. The `medications` row holds the user's own strings.

**Fuse.js configuration (starting point — tune empirically):**
- Keys: `genericName` (weight 0.6), `brandNames` (weight 0.8)
- Threshold: `0.3` (lower = stricter match, higher = fuzzier)
- Max results: 5

---

## SQLite Integration

When the user selects a catalog entry and saves a medication, the app writes one additional
field alongside the standard `name`, `dose`, `route`, `frequency`:

```sql
-- V1 migration: add nullable catalog reference to medications table
ALTER TABLE medications ADD COLUMN catalog_rxcui TEXT;
```

`catalog_rxcui` is:
- Populated when the user picks from autocomplete (`rxcui` of the selected entry).
- NULL when the user enters a medication by free text (no catalog match).
- Never used for display. The Medications tab renders `name`, `dose`, `route` from SQLite directly.
- Reserved for future features: drug interaction warnings, catalog cross-referencing on export.

**Note on intent vs. accuracy:** `catalog_rxcui` captures what the user appeared to
intend at entry time — which catalog entry they selected. If the user subsequently
edits the name, dose, or route fields away from the catalog values, `catalog_rxcui`
no longer matches the displayed data. This is expected and acceptable. The stored value
is a best-effort record of intent, not a live foreign key to the catalog. Future product
versions may surface mismatches to ask the user whether they want to re-link — but
that is out of scope for V1, and no code currently reads `catalog_rxcui` at all.

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

### Pipeline Steps

```
For each ingredient in src/rxcui_classes.py INGREDIENT_CLASSES:

1. Query RxNorm REST API for stable RXCUI by ingredient name
   GET rxnav.nlm.nih.gov/REST/rxcui.json?name={name}&search=1

2. Query OpenFDA NDC API for all NDC records matching that generic name
   GET api.fda.gov/drug/ndc.json?search=generic_name:"{name}"&limit=1000

3. Extract from NDC records:
   - brand_name → brandNames (title-cased, deduplicated, generic excluded)
   - active_ingredients[].strength → strengths (normalised to "200 mg" form)
   - route[] → routes (mapped to canonical values: oral, topical, injectable, ...)

4. Skip entry if no strengths or no routes found

5. Apply whitelist (medications_whitelist.json): force-include entries + combinations
6. Apply blacklist (medications_blacklist.json): remove entries by RXCUI
7. Validate output (see test criteria below)
8. Write constants/medicationCatalog.ts
```

### Whitelist / Blacklist Format

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
  {
    "rxcui": "789012",
    "reason": "Recalled / not appropriate for this app"
  }
]
```

Whitelist and blacklist entries are version-controlled in the repo alongside the script.
Changes to either file require a new script run + commit of the updated catalog.

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
