import { getDb } from './client';
import { Dose, DoseRow } from './schema';

function now(): string {
  return new Date().toISOString();
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Primary "Took it now" action — inserts with taken_at = current timestamp.
export async function logDoseNow(medicationId: number, note?: string): Promise<Dose> {
  const db = await getDb();
  const taken_at = now();
  const result = await db.runAsync(
    'INSERT INTO medication_doses (medication_id, taken_at, note) VALUES (?, ?, ?)',
    [medicationId, taken_at, note ?? null]
  );
  const row = await db.getFirstAsync<DoseRow>(
    'SELECT * FROM medication_doses WHERE id = ?', [result.lastInsertRowId]
  );
  return row!;
}

export async function getDosesForMedication(medicationId: number): Promise<Dose[]> {
  const db = await getDb();
  return db.getAllAsync<DoseRow>(
    'SELECT * FROM medication_doses WHERE medication_id = ? ORDER BY taken_at DESC',
    [medicationId]
  );
}

// Returns count of doses taken today, keyed by medication_id.
// Used on the Medications screen to show "X doses today".
export async function getTodayDoseCountByMedication(): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ medication_id: number; count: number }>(
    `SELECT medication_id, COUNT(*) as count
     FROM medication_doses
     WHERE taken_at >= ?
     GROUP BY medication_id`,
    [todayStart()]
  );
  return Object.fromEntries(rows.map(r => [r.medication_id, r.count]));
}

// Returns the most recent dose per medication_id (for "last taken" display).
export async function getLastDoseByMedication(): Promise<Record<number, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ medication_id: number; taken_at: string }>(
    `SELECT medication_id, MAX(taken_at) as taken_at
     FROM medication_doses
     GROUP BY medication_id`
  );
  return Object.fromEntries(rows.map(r => [r.medication_id, r.taken_at]));
}

// Returns total doses per medication within a date range (for reports).
export async function getDoseCountsInRange(
  fromISO: string,
  toISO: string
): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ medication_id: number; count: number }>(
    `SELECT medication_id, COUNT(*) as count
     FROM medication_doses
     WHERE taken_at >= ? AND taken_at <= ?
     GROUP BY medication_id`,
    [fromISO, toISO]
  );
  return Object.fromEntries(rows.map(r => [r.medication_id, r.count]));
}
