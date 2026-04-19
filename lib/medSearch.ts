import { MEDICATION_CATALOG, type MedCatalogEntry } from '@/constants/medicationCatalog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchItem {
  entry:       MedCatalogEntry;
  searchKey:   string;   // the string we match the query against
  displayName: string;   // shown in the suggestion row and written to the Name field
  strength:    string;   // pre-selected dose for this suggestion
  isGeneric:   boolean;
}

export interface SuggestionResult {
  entry:       MedCatalogEntry;
  displayName: string;
  strength:    string;
  isGeneric:   boolean;
  metaLabel:   string;  // e.g. "NSAID" or "ibuprofen · NSAID"
}

// ─── Index builder ────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildSearchIndex(catalog: MedCatalogEntry[] = MEDICATION_CATALOG): SearchItem[] {
  const items: SearchItem[] = [];
  for (const entry of catalog) {
    const genericDisplay = capitalize(entry.genericName);
    for (const strength of entry.strengths) {
      items.push({ entry, searchKey: entry.genericName, displayName: genericDisplay, strength, isGeneric: true });
    }
    for (const brand of entry.brandNames) {
      for (const strength of entry.strengths) {
        items.push({ entry, searchKey: brand, displayName: brand, strength, isGeneric: false });
      }
    }
  }
  return items;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreMatch(searchKey: string, query: string): number {
  const k = searchKey.toLowerCase();
  const q = query.toLowerCase();
  if (k === q) return 100;
  if (k.startsWith(q)) return 90;
  if (k.split(/\s+/).some(word => word.startsWith(q))) return 75;
  if (k.includes(q)) return 60;
  return 0;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function searchMedications(
  query:      string,
  index:      SearchItem[],
  maxResults: number = 5,
): SuggestionResult[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const scored = index
    .map(item => ({ item, sc: scoreMatch(item.searchKey, q) }))
    .filter(r => r.sc > 0)
    .sort((a, b) => {
      if (b.sc !== a.sc) return b.sc - a.sc;
      // Tie-break 1: generics before brands (exact generic query → generic first)
      if (a.item.isGeneric !== b.item.isGeneric) return a.item.isGeneric ? -1 : 1;
      // Tie-break 2: shorter search key = closer match ("Advil" before "Advil Migraine")
      return a.item.searchKey.length - b.item.searchKey.length;
    });

  // One row per (entry, strength) — prevents duplicate doses from different brand items
  const seen    = new Set<string>();
  const results: SuggestionResult[] = [];

  for (const { item } of scored) {
    if (results.length >= maxResults) break;
    const key = `${item.entry.rxcui}|${item.strength}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const metaLabel = item.isGeneric
      ? item.entry.drugClass
      : `${item.entry.genericName} · ${item.entry.drugClass}`;

    results.push({ entry: item.entry, displayName: item.displayName, strength: item.strength, isGeneric: item.isGeneric, metaLabel });
  }
  return results;
}

// ─── Route helper ─────────────────────────────────────────────────────────────

// Alphabetical sort puts "injectable" before "oral". This picks the most
// patient-relevant route when pre-filling the form.
const ROUTE_PREFERENCE = ['oral', 'sublingual', 'topical', 'transdermal', 'nasal', 'rectal', 'injectable'];

export function preferredRoute(routes: string[]): string {
  for (const pref of ROUTE_PREFERENCE) {
    if (routes.includes(pref)) return pref;
  }
  return routes[0] ?? '';
}
