"""
pytest test_medications.py

Validates constants/medicationCatalog.ts against quality gates.
Run after update_medications.py before committing the output file.
"""

import json
import re
import sys
from pathlib import Path

import pytest

TOOL_DIR   = Path(__file__).parent
REPO_ROOT  = TOOL_DIR.parent.parent
OUTPUT_PATH = REPO_ROOT / "constants" / "medicationCatalog.ts"

VALID_DRUG_CLASSES = {
    "NSAID",
    "Opioid",
    "Muscle Relaxant",
    "Anticonvulsant",
    "Adjuvant",
    "Combination",
    "Other",
}

REQUIRED_GENERICS = [
    "ibuprofen",
    "acetaminophen",
    "naproxen",
    "tramadol",
    "gabapentin",
    "oxycodone",
    "morphine",
    "cyclobenzaprine",
    "pregabalin",
    "duloxetine",
    "diclofenac",
    "baclofen",
    "amitriptyline",
]

STRENGTH_RE = re.compile(r"^\d+(?:\.\d+)?\s+\S+(?:\s*/\s*\d+(?:\.\d+)?\s+\S+)*$")
ROUTE_RE    = re.compile(r"^[a-z]+$")


# ── Fixture ───────────────────────────────────────────────────────────────────

def _parse_catalog() -> list[dict]:
    if not OUTPUT_PATH.exists():
        pytest.skip(f"{OUTPUT_PATH} not yet generated — run: python src/update_medications.py")

    text = OUTPUT_PATH.read_text(encoding="utf-8")
    m = re.search(
        r"MEDICATION_CATALOG:\s*MedCatalogEntry\[\]\s*=\s*(\[.*?\]);",
        text, re.DOTALL,
    )
    if not m:
        raise ValueError("Could not locate MEDICATION_CATALOG array in output file")

    array_text = m.group(1)
    array_text = re.sub(r",(\s*[}\]])", r"\1", array_text)          # strip trailing commas
    array_text = re.sub(r'([{,])\s*([a-zA-Z_]\w*)\s*:', r'\1 "\2":', array_text)  # quote unquoted keys
    return json.loads(array_text)


@pytest.fixture(scope="session")
def catalog() -> list[dict]:
    return _parse_catalog()


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_minimum_entry_count(catalog):
    assert len(catalog) >= 50, (
        f"Only {len(catalog)} entries — pipeline may have failed. Expected ≥50."
    )


def test_no_duplicate_rxcuis(catalog):
    rxcuis = [e["rxcui"] for e in catalog]
    dupes  = {r for r in rxcuis if rxcuis.count(r) > 1}
    assert not dupes, f"Duplicate rxcuis: {dupes}"


def test_no_duplicate_generic_names(catalog):
    names = [e["genericName"] for e in catalog]
    dupes = {n for n in names if names.count(n) > 1}
    assert not dupes, f"Duplicate genericNames: {dupes}"


def test_required_generics_present(catalog):
    names   = {e["genericName"] for e in catalog}
    missing = [g for g in REQUIRED_GENERICS if g not in names]
    assert not missing, f"Required generic(s) missing: {missing}"


def test_all_entries_have_required_fields(catalog):
    for e in catalog:
        assert e.get("rxcui"),       f"Missing rxcui: {e}"
        assert e.get("genericName"), f"Missing genericName: {e}"
        assert e.get("strengths"),   f"Empty strengths: {e}"
        assert e.get("routes"),      f"Empty routes: {e}"
        assert e.get("drugClass"),   f"Missing drugClass: {e}"


def test_drug_classes_are_valid(catalog):
    for e in catalog:
        assert e["drugClass"] in VALID_DRUG_CLASSES, (
            f"{e['genericName']}: invalid drugClass '{e['drugClass']}'"
        )


def test_generic_names_are_lowercase(catalog):
    for e in catalog:
        assert e["genericName"] == e["genericName"].lower(), (
            f"Not lowercase: '{e['genericName']}'"
        )


def test_brand_names_start_uppercase(catalog):
    for e in catalog:
        for brand in e.get("brandNames", []):
            assert brand and brand[0].isupper(), (
                f"{e['genericName']}: brand '{brand}' should start uppercase"
            )


def test_strength_format(catalog):
    for e in catalog:
        for s in e["strengths"]:
            assert STRENGTH_RE.match(s), (
                f"{e['genericName']}: unexpected strength format '{s}'"
            )


def test_route_format(catalog):
    for e in catalog:
        for r in e["routes"]:
            assert ROUTE_RE.match(r), (
                f"{e['genericName']}: unexpected route format '{r}'"
            )


def test_sorted_by_generic_name(catalog):
    names = [e["genericName"] for e in catalog]
    assert names == sorted(names), "Catalog is not sorted by genericName"


def test_brand_name_quality(catalog):
    for e in catalog:
        for brand in e.get("brandNames", []):
            assert e["genericName"].lower() not in brand.lower(), (
                f"{e['genericName']}: brand '{brand}' contains the generic name"
            )
            assert len(brand.split()) <= 4, (
                f"{e['genericName']}: brand '{brand}' has >4 words (likely a product description, not a brand)"
            )


def test_whitelist_combinations_present(catalog):
    names = {e["genericName"] for e in catalog}
    for expected in ["hydrocodone / acetaminophen", "oxycodone / acetaminophen"]:
        assert expected in names, f"Whitelist combination missing: '{expected}'"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
