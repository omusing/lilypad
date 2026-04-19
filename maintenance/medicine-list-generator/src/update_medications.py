#!/usr/bin/env python3
"""
Build the Lilypad medication autocomplete catalog from public APIs.

Data sources (both free, no registration required):
  - RxNorm REST API  (rxnav.nlm.nih.gov)  — stable RxCUI per ingredient
  - OpenFDA NDC API  (api.fda.gov)         — brand names, strengths, routes

Usage (from maintenance/medicine-list-generator/):
    python src/update_medications.py

Output: constants/medicationCatalog.ts (repo root)
"""

import json
import sys
import time
from pathlib import Path
from typing import Optional

import requests

SRC_DIR   = Path(__file__).parent
TOOL_DIR  = SRC_DIR.parent
REPO_ROOT = TOOL_DIR.parent.parent

OUTPUT_PATH             = REPO_ROOT / "constants" / "medicationCatalog.ts"
WHITELIST_PATH          = TOOL_DIR / "medications_whitelist.json"
BLACKLIST_PATH          = TOOL_DIR / "medications_blacklist.json"
STRENGTH_WHITELIST_PATH = TOOL_DIR / "strength_whitelist.json"

# Maximum words in a brand name. Longer strings are product descriptions, not brand names.
MAX_BRAND_WORDS = 4
# An ANDA strength must appear in at least this many NDC records to be included
# (catches commonly manufactured generic doses not covered by an NDA record).
MIN_ANDA_STRENGTH_COUNT = 3

RXNORM_API  = "https://rxnav.nlm.nih.gov/REST"
OPENFDA_API = "https://api.fda.gov/drug/ndc.json"

# OpenFDA route strings → catalog route values
ROUTE_MAP: dict[str, str] = {
    "oral":           "oral",
    "sublingual":     "sublingual",
    "buccal":         "sublingual",
    "inhalation":     "inhalation",
    "nasal":          "nasal",
    "intranasal":     "nasal",
    "rectal":         "rectal",
    "ophthalmic":     "ophthalmic",
    "otic":           "otic",
    "transdermal":    "transdermal",
    "topical":        "topical",
    "intravenous":    "injectable",
    "intramuscular":  "injectable",
    "subcutaneous":   "injectable",
    "injectable":     "injectable",
}


# ── RxNorm REST ───────────────────────────────────────────────────────────────

def fetch_rxcui(generic_name: str, session: requests.Session) -> Optional[str]:
    """Return the RxNorm ingredient RXCUI for a generic name, or None."""
    url = f"{RXNORM_API}/rxcui.json"
    try:
        resp = session.get(url, params={"name": generic_name, "search": "1"}, timeout=10)
        if resp.status_code != 200:
            return None
        ids = resp.json().get("idGroup", {}).get("rxnormId", [])
        return ids[0] if ids else None
    except Exception:
        return None


# ── OpenFDA NDC ───────────────────────────────────────────────────────────────

def fetch_ndc_records(generic_name: str, session: requests.Session) -> list[dict]:
    """Return up to 1000 NDC records whose generic_name matches."""
    try:
        resp = session.get(
            OPENFDA_API,
            params={"search": f'generic_name:"{generic_name}"', "limit": 1000},
            timeout=15,
        )
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return resp.json().get("results", [])
    except Exception:
        return []


# Abbreviations that should stay fully uppercase in brand names.
# .title() converts "PM" → "Pm", "ER" → "Er", etc. — wrong for drug brand names.
_UPPER_ABBREVS = frozenset({
    'PM', 'AM', 'ER', 'IR', 'XR', 'SR', 'CR', 'DR', 'XL', 'LA',
    'IV', 'DM', 'PE', 'IB', 'HBP', 'HCL', 'HBR', 'DS', 'XS',
})


def _title_brand(s: str) -> str:
    """Title-case a brand name, keeping known abbreviations uppercase."""
    parts = []
    for word in s.split():
        stripped = word.rstrip(',.;-')
        suffix   = word[len(stripped):]
        parts.append((stripped.upper() if stripped.upper() in _UPPER_ABBREVS else stripped.capitalize()) + suffix)
    return ' '.join(parts)


def _normalize_strength(raw: str) -> Optional[str]:
    """
    '200 MG/1'        → '200 mg'
    '0.05 MG/ML'      → '0.05 mg/ml'
    '200 MG/TABLET'   → '200 mg'
    """
    raw = raw.strip()
    import re
    # Match: number unit [/ denominator_unit]
    m = re.match(
        r"(\d+(?:\.\d+)?)\s*(mg/actuat|mg/ml|mg/hr|mcg/actuat|mcg/hr|mcg|mg|meq|%)"
        r"(?:/.*)?$",
        raw, re.IGNORECASE,
    )
    if not m:
        return None
    num  = m.group(1)
    unit = m.group(2).lower()
    # Drop trailing /1
    return f"{num} {unit}"


def _normalize_route(raw: str) -> Optional[str]:
    return ROUTE_MAP.get(raw.lower().strip())


def _strength_sort_key(s: str) -> float:
    import re
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else 0.0


def _is_clean_brand(brand: str, generic_name: str) -> bool:
    """Return True if brand looks like a genuine consumer brand name.

    Filters out store/private-label brands, generic-labeled products,
    combination-product descriptions, and pediatric formulations.
    """
    import re
    # Contains the ingredient name — it's just a labeled generic ("Ibuprofen 200 Mg")
    if generic_name.lower() in brand.lower():
        return False
    # More than MAX_BRAND_WORDS words — it's a product description, not a brand
    if len(brand.split()) > MAX_BRAND_WORDS:
        return False
    # Contains "And" — combination product description, not a consumer brand name
    if re.search(r'\bAnd\b', brand):
        return False
    # Pediatric/infant formulations — not relevant for adult pain management
    if re.search(r'\b(children|childrens|infant|infants|junior|kids|pediatric|peds)\b', brand, re.IGNORECASE):
        return False
    return True


def extract_from_ndc(records: list[dict], generic_name: str) -> dict:
    """Aggregate brand names, strengths, routes from NDC records.

    Brand names: NDA records only (innovator/brand-name drugs). ANDA records
    (generics, store brands, private label) are excluded. Combination-product
    brands (e.g. Advil Allergy Sinus, Advil PM) remain in the brand list for
    the parent generic; they should be added as their own whitelist entries if
    full catalog coverage is needed.

    Strengths: NDA-sourced strengths plus any ANDA strength appearing in at least
    MIN_ANDA_STRENGTH_COUNT records (commonly manufactured = commonly prescribed).
    """
    nda_brands:          set[str]       = set()
    nda_strengths:       set[str]       = set()
    anda_strength_counts: dict[str, int] = {}
    routes:              set[str]       = set()

    for r in records:
        app_num = r.get("application_number", "")
        is_nda  = isinstance(app_num, str) and app_num.upper().startswith("NDA")

        # Only include brand names from single-ingredient NDA products.
        # Multi-ingredient NDA products (e.g. Excedrin under aspirin) would create
        # wrong (brand, single-ingredient-strength) pairs in the flat search index.
        is_single_ingredient = len(r.get("active_ingredients", [])) == 1
        brand = _title_brand(r.get("brand_name", "").strip())
        if brand and is_nda and is_single_ingredient and _is_clean_brand(brand, generic_name):
            nda_brands.add(brand)

        for ai in r.get("active_ingredients", []):
            s = _normalize_strength(ai.get("strength", ""))
            if s:
                if is_nda:
                    nda_strengths.add(s)
                else:
                    anda_strength_counts[s] = anda_strength_counts.get(s, 0) + 1

        for route_raw in r.get("route", []):
            mapped = _normalize_route(route_raw)
            if mapped:
                routes.add(mapped)

    all_strengths = nda_strengths | {
        s for s, count in anda_strength_counts.items()
        if count >= MIN_ANDA_STRENGTH_COUNT
    }

    return {
        "brandNames": sorted(nda_brands),
        "strengths":  sorted(all_strengths, key=_strength_sort_key),
        "routes":     sorted(routes),
    }


# ── Catalog build ─────────────────────────────────────────────────────────────

def build_catalog(
    ingredient_classes: dict[str, str],
    whitelist: list[dict],
    blacklist: list[dict],
    strength_whitelist: list[dict],
) -> list[dict]:

    blacklist_set      = {e["rxcui"] for e in blacklist}
    whitelist_map      = {e["rxcui"]: e for e in whitelist}
    # Map rxcui → full whitelist entry (strengths + optional additionalBrands)
    strength_overrides = {e["rxcui"]: e for e in strength_whitelist}

    session = requests.Session()
    session.headers["User-Agent"] = "Lilypad/catalog-builder (non-commercial, research use)"

    catalog: list[dict] = []
    total = len(ingredient_classes)

    for i, (generic_name, drug_class) in enumerate(ingredient_classes.items(), 1):
        print(f"  [{i}/{total}] {generic_name}...", flush=True)

        rxcui = fetch_rxcui(generic_name, session)
        if not rxcui:
            print(f"    ✗ no RxCUI found — skipping")
            time.sleep(0.1)
            continue

        if rxcui in blacklist_set:
            print(f"    ✗ blacklisted")
            time.sleep(0.1)
            continue

        records = fetch_ndc_records(generic_name, session)
        if not records:
            print(f"    ✗ no NDC records found — skipping")
            time.sleep(0.1)
            continue

        data = extract_from_ndc(records, generic_name)

        if not data["strengths"] or not data["routes"]:
            print(f"    ✗ missing strengths or routes — skipping")
            time.sleep(0.1)
            continue

        # Whitelist may override drug class
        wl = whitelist_map.get(rxcui)
        if wl:
            drug_class = wl.get("drugClass", drug_class)

        # Strength whitelist: override strengths and optionally inject known brands
        # that use OTC Drug Monographs instead of NDAs (e.g. Tylenol → M013, not NDA)
        if rxcui in strength_overrides:
            override = strength_overrides[rxcui]
            data["strengths"] = override["strengths"]
            if "additionalBrands" in override:
                data["brandNames"] = sorted(set(data["brandNames"]) | set(override["additionalBrands"]))

        print(f"    ✓ rxcui={rxcui}  brands={len(data['brandNames'])}  "
              f"strengths={data['strengths']}  routes={data['routes']}")

        catalog.append({
            "rxcui":       rxcui,
            "genericName": generic_name,
            "brandNames":  data["brandNames"],
            "strengths":   data["strengths"],
            "routes":      data["routes"],
            "drugClass":   drug_class,
        })

        # Polite rate limiting: ~4 req/s (2 calls per ingredient)
        time.sleep(0.25)

    # Fully-manual whitelist entries (combinations not in ingredient seed)
    existing_rxcuis = {e["rxcui"] for e in catalog}
    for wl in whitelist:
        if wl["rxcui"] in existing_rxcuis or wl["rxcui"] in blacklist_set:
            continue
        required = ("genericName", "strengths", "routes", "drugClass")
        if all(k in wl for k in required):
            print(f"  [whitelist] {wl['genericName']}")
            catalog.append({
                "rxcui":       wl["rxcui"],
                "genericName": wl["genericName"],
                "brandNames":  wl.get("brandNames", []),
                "strengths":   wl["strengths"],
                "routes":      wl["routes"],
                "drugClass":   wl["drugClass"],
            })

    return sorted(catalog, key=lambda e: e["genericName"])


# ── TypeScript output ─────────────────────────────────────────────────────────

def write_typescript(catalog: list[dict], path: Path) -> None:
    lines = [
        "// AUTO-GENERATED by maintenance/medicine-list-generator/src/update_medications.py",
        "// Do not edit manually. Regenerate: python src/update_medications.py",
        "",
        "export type DrugClass =",
        "  | 'NSAID'",
        "  | 'Opioid'",
        "  | 'Muscle Relaxant'",
        "  | 'Anticonvulsant'",
        "  | 'Adjuvant'",
        "  | 'Combination'",
        "  | 'Other';",
        "",
        "export interface MedCatalogEntry {",
        "  rxcui:       string;",
        "  genericName: string;",
        "  brandNames:  string[];",
        "  strengths:   string[];",
        "  routes:      string[];",
        "  drugClass:   DrugClass;",
        "}",
        "",
        f"// {len(catalog)} entries",
        "export const MEDICATION_CATALOG: MedCatalogEntry[] = [",
    ]

    for e in catalog:
        lines.append(
            f"  {{ rxcui: {json.dumps(e['rxcui'])}, "
            f"genericName: {json.dumps(e['genericName'])}, "
            f"brandNames: {json.dumps(e['brandNames'])}, "
            f"strengths: {json.dumps(e['strengths'])}, "
            f"routes: {json.dumps(e['routes'])}, "
            f"drugClass: {json.dumps(e['drugClass'])} }},"
        )

    lines += ["];", ""]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nWrote {len(catalog)} entries → {path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    sys.path.insert(0, str(SRC_DIR))
    from rxcui_classes import INGREDIENT_CLASSES

    whitelist:          list[dict] = json.loads(WHITELIST_PATH.read_text())          if WHITELIST_PATH.exists()          else []
    blacklist:          list[dict] = json.loads(BLACKLIST_PATH.read_text())          if BLACKLIST_PATH.exists()          else []
    strength_whitelist: list[dict] = json.loads(STRENGTH_WHITELIST_PATH.read_text()) if STRENGTH_WHITELIST_PATH.exists() else []

    print(f"Building catalog for {len(INGREDIENT_CLASSES)} ingredients via RxNorm + OpenFDA APIs...")
    print("No download required — querying public APIs directly.\n")
    print(f"  NDA filter: ON  |  strength overrides: {len(strength_whitelist)} entries\n")

    catalog = build_catalog(INGREDIENT_CLASSES, whitelist, blacklist, strength_whitelist)
    write_typescript(catalog, OUTPUT_PATH)


if __name__ == "__main__":
    main()
