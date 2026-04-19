import { getDb } from './client';
import {
  Entry, EntryRow, NewEntry, EntryUpdate, rowToEntry,
} from './schema';

function now(): string {
  return new Date().toISOString();
}

function toDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function insertEntry(data: NewEntry): Promise<Entry> {
  const db = await getDb();
  const created_at = now();
  const entry_date = data.entry_date ?? toDateString();

  const result = await db.runAsync(
    `INSERT INTO entries
      (entry_date, pain_level, pain_regions, pain_qualities, triggers,
       mood, sleep_quality, medication_ids, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry_date,
      data.pain_level,
      JSON.stringify(data.pain_regions),
      data.pain_qualities.length   ? JSON.stringify(data.pain_qualities)   : null,
      data.triggers.length         ? JSON.stringify(data.triggers)         : null,
      data.mood           ?? null,
      data.sleep_quality  ?? null,
      data.medication_ids.length   ? JSON.stringify(data.medication_ids)   : null,
      data.note           ?? null,
      created_at,
    ]
  );

  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entries WHERE id = ?',
    [result.lastInsertRowId]
  );
  return rowToEntry(row!);
}

export async function updateEntry(id: number, data: EntryUpdate): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.entry_date       !== undefined) { fields.push('entry_date = ?');       values.push(data.entry_date); }
  if (data.pain_level       !== undefined) { fields.push('pain_level = ?');       values.push(data.pain_level); }
  if (data.pain_regions     !== undefined) { fields.push('pain_regions = ?');     values.push(JSON.stringify(data.pain_regions)); }
  if (data.pain_qualities   !== undefined) { fields.push('pain_qualities = ?');   values.push(data.pain_qualities.length ? JSON.stringify(data.pain_qualities) : null); }
  if (data.triggers         !== undefined) { fields.push('triggers = ?');         values.push(data.triggers.length ? JSON.stringify(data.triggers) : null); }
  if (data.mood             !== undefined) { fields.push('mood = ?');             values.push(data.mood); }
  if (data.sleep_quality    !== undefined) { fields.push('sleep_quality = ?');    values.push(data.sleep_quality); }
  if (data.medication_ids   !== undefined) { fields.push('medication_ids = ?');   values.push(data.medication_ids.length ? JSON.stringify(data.medication_ids) : null); }
  if (data.note             !== undefined) { fields.push('note = ?');             values.push(data.note); }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(now());
  values.push(id);

  await db.runAsync(
    `UPDATE entries SET ${fields.join(', ')} WHERE id = ?`,
    values as SQLiteBindValue[]
  );
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getEntries(): Promise<Entry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM entries ORDER BY created_at DESC'
  );
  return rows.map(rowToEntry);
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entries WHERE id = ?', [id]
  );
  return row ? rowToEntry(row) : null;
}

// Returns entries where entry_date falls within [fromDate, toDate] inclusive.
// Used by the Report screen.
export async function getEntriesInRange(fromDate: string, toDate: string): Promise<Entry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries
     WHERE entry_date >= ? AND entry_date <= ?
     ORDER BY entry_date ASC, created_at ASC`,
    [fromDate, toDate]
  );
  return rows.map(rowToEntry);
}

export async function getLatestEntry(): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entries ORDER BY created_at DESC LIMIT 1'
  );
  return row ? rowToEntry(row) : null;
}

// Returns entries for the last N calendar days — used by the home sparkline.
export async function getRecentEntries(days: number): Promise<Entry[]> {
  const fromDate = toDateString(new Date(Date.now() - (days - 1) * 86_400_000));
  return getEntriesInRange(fromDate, toDateString());
}

// ─── import helpers ──────────────────────────────────────────────────────────

// Used by import flow. Returns true if an entry with this created_at already exists.
export async function entryExistsByCreatedAt(created_at: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM entries WHERE created_at = ?', [created_at]
  );
  return row !== null;
}

// ─── types ───────────────────────────────────────────────────────────────────

// expo-sqlite bind value type (string | number | null | Uint8Array)
type SQLiteBindValue = string | number | null | Uint8Array;
