# Medicine List Generator

Generates `constants/medicationCatalog.ts` — the offline medication autocomplete
bundle used by the Lilypad app's Add Medication form.

Data source: [RxNorm Prescribable Content](https://www.nlm.nih.gov/research/umls/rxnorm/docs/rxnormfiles.html)
(freely downloadable, no UMLS registration required).

---

## Prerequisites

- Python 3.11+
- Internet access (queries two free public APIs — no accounts, no downloads)

---

## Setup

```bash
cd maintenance/medicine-list-generator
./setup.sh
```

This creates a `.venv` virtual environment and installs dependencies.
Activate it before running any commands:

```bash
source .venv/Scripts/activate   # Windows (Git Bash)
source .venv/bin/activate       # macOS / Linux
```

---

## Usage

### Generate the catalog

```bash
python src/update_medications.py
```

Queries the RxNorm REST API and OpenFDA NDC API directly — no file download, no
account needed. Takes ~2 minutes for ~80 ingredients.

Output: `../../constants/medicationCatalog.ts` (relative to this tool).

### Run tests

```bash
pytest test_medications.py -v
```

Tests validate the generated catalog against quality gates (entry count,
required drugs, format checks, no duplicates). Run them before committing
the output file.

### Full workflow

```bash
python src/update_medications.py
pytest test_medications.py -v
git add ../../constants/medicationCatalog.ts
git commit -m "catalog: regenerate from RxNorm YYYYMMDD"
```

---

## Customisation

### Add a medication (whitelist)

Edit `medications_whitelist.json`. Two cases:

**Drug exists in RxNorm but is unclassified** — provide `rxcui` and `drugClass`:
```json
{ "rxcui": "123456", "reason": "why", "drugClass": "Adjuvant" }
```

**Drug not in RxNorm, or a combination** — provide all fields:
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

### Remove a medication (blacklist)

Edit `medications_blacklist.json`:
```json
{ "rxcui": "789012", "reason": "Recalled / not appropriate for this app" }
```

### Add a new drug class to the seed

Edit `src/rxcui_classes.py` — add the ingredient name (lowercase) to
`INGREDIENT_CLASSES` under the appropriate class.

---

## File structure

```
medicine-list-generator/
  src/
    update_medications.py   # Main pipeline
    rxcui_classes.py        # Ingredient name → DrugClass seed + OpenFDA keyword map
  test_medications.py       # pytest quality-gate tests
  medications_whitelist.json
  medications_blacklist.json
  requirements.txt
  setup.sh
  README.md
  rxnorm_current.zip        # Cached download — gitignored, re-download to refresh
```

The `rxnorm_current.zip` is gitignored. Delete it and re-run to pick up a new
RxNorm release.
