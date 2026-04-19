// TypeScript types for all DB rows and application objects.
// "Row" types mirror SQLite columns exactly (JSON arrays stored as strings).
// Application types have parsed arrays — query modules handle the conversion.

// ─── entries ────────────────────────────────────────────────────────────────

export interface EntryRow {
  id:             number;
  entry_date:     string;        // YYYY-MM-DD
  pain_level:     number;        // 0–10
  pain_regions:   string;        // JSON array
  pain_qualities: string | null; // JSON array
  triggers:       string | null; // JSON array
  mood:           number | null; // 1–5
  sleep_quality:  number | null; // 1–5
  medication_ids: string | null; // JSON array of medications.id
  note:           string | null;
  created_at:     string;        // ISO 8601
  updated_at:     string | null; // ISO 8601
}

export interface Entry {
  id:             number;
  entry_date:     string;
  pain_level:     number;
  pain_regions:   string[];
  pain_qualities: string[];
  triggers:       string[];
  mood:           number | null;
  sleep_quality:  number | null;
  medication_ids: number[];
  note:           string | null;
  created_at:     string;
  updated_at:     string | null;
}

export type NewEntry = Omit<Entry, 'id' | 'created_at' | 'updated_at'>;
export type EntryUpdate = Partial<Omit<Entry, 'id' | 'created_at'>>;

// ─── medications ────────────────────────────────────────────────────────────

export interface MedicationRow {
  id:              number;
  name:            string;
  dose:            string | null;
  route:           string | null;
  frequency:       string | null;
  is_active:       number;   // 1 | 0
  created_at:      string;
  catalog_rxcui:   string | null;
}

export interface Medication {
  id:              number;
  name:            string;
  dose:            string | null;
  route:           string | null;
  frequency:       string | null;
  is_active:       boolean;
  created_at:      string;
  catalog_rxcui:   string | null;
}

export type NewMedication = Omit<Medication, 'id' | 'is_active' | 'created_at'>;
export type MedicationUpdate = Partial<Pick<Medication, 'name' | 'dose' | 'route' | 'frequency' | 'catalog_rxcui'>>;

// ─── medication_doses ────────────────────────────────────────────────────────

export interface DoseRow {
  id:            number;
  medication_id: number;
  taken_at:      string;        // ISO 8601
  note:          string | null;
}

export type Dose = DoseRow; // no JSON columns, types match directly

// ─── app_settings ────────────────────────────────────────────────────────────

export interface SettingsRow {
  id:               number;  // always 1
  patient_name:     string | null;
  morning_reminder: number;  // 0 | 1
  morning_time:     string;  // HH:MM
  evening_reminder: number;  // 0 | 1
  evening_time:     string;  // HH:MM
  onboarding_done:  number;  // 0 | 1
  schema_version:   number;
}

export interface Settings {
  patient_name:     string | null;
  morning_reminder: boolean;
  morning_time:     string;
  evening_reminder: boolean;
  evening_time:     string;
  onboarding_done:  boolean;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

export function rowToEntry(row: EntryRow): Entry {
  return {
    ...row,
    pain_regions:   JSON.parse(row.pain_regions),
    pain_qualities: row.pain_qualities   ? JSON.parse(row.pain_qualities)   : [],
    triggers:       row.triggers         ? JSON.parse(row.triggers)         : [],
    medication_ids: row.medication_ids   ? JSON.parse(row.medication_ids)   : [],
  };
}

export function rowToMedication(row: MedicationRow): Medication {
  return { ...row, is_active: row.is_active === 1, catalog_rxcui: row.catalog_rxcui ?? null };
}

export function rowToSettings(row: SettingsRow): Settings {
  return {
    patient_name:     row.patient_name,
    morning_reminder: row.morning_reminder === 1,
    morning_time:     row.morning_time,
    evening_reminder: row.evening_reminder === 1,
    evening_time:     row.evening_time,
    onboarding_done:  row.onboarding_done === 1,
  };
}
