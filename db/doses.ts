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

// Logs one session per medication. counts: { medicationId → quantity }.
// All rows share the same taken_at (the moment the user tapped "Log Doses").
export async function logDosesBatch(
  counts: Record<number, number>,
  note?: string
): Promise<void> {
  const db = await getDb();
  const taken_at = now();
  await db.withTransactionAsync(async () => {
    for (const [medId, quantity] of Object.entries(counts)) {
      if (quantity < 1) continue;
      await db.runAsync(
        'INSERT INTO medication_doses (medication_id, taken_at, quantity, note) VALUES (?, ?, ?, ?)',
        [Number(medId), taken_at, quantity, note ?? null]
      );
    }
  });
}

// Quick single-medication dose (e.g. "Took it now" from pain wizard).
export async function logDoseNow(medicationId: number, note?: string): Promise<Dose> {
  const db = await getDb();
  const taken_at = now();
  const result = await db.runAsync(
    'INSERT INTO medication_doses (medication_id, taken_at, quantity, note) VALUES (?, ?, 1, ?)',
    [medicationId, taken_at, note ?? null]
  );
  const row = await db.getFirstAsync<DoseRow>(
    'SELECT * FROM medication_doses WHERE id = ?', [result.lastInsertRowId]
  );
  return row!;
}

export async function updateDose(
  id: number,
  data: { medication_id?: number; quantity?: number; taken_at?: string; note?: string | null }
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.medication_id !== undefined) { fields.push('medication_id = ?'); values.push(data.medication_id); }
  if (data.quantity      !== undefined) { fields.push('quantity = ?');      values.push(data.quantity); }
  if (data.taken_at      !== undefined) { fields.push('taken_at = ?');      values.push(data.taken_at); }
  if (data.note          !== undefined) { fields.push('note = ?');           values.push(data.note); }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(now());
  values.push(id);

  await db.runAsync(
    `UPDATE medication_doses SET ${fields.join(', ')} WHERE id = ?`,
    values as (string | number | null)[]
  );
}

export async function deleteDose(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medication_doses WHERE id = ?', [id]);
}

export async function getDose(id: number): Promise<Dose | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DoseRow>(
    'SELECT * FROM medication_doses WHERE id = ?', [id]
  );
  return row ?? null;
}

export async function getDosesForMedication(medicationId: number): Promise<Dose[]> {
  const db = await getDb();
  return db.getAllAsync<DoseRow>(
    'SELECT * FROM medication_doses WHERE medication_id = ? ORDER BY taken_at DESC',
    [medicationId]
  );
}

// Returns total quantity of doses taken today, keyed by medication_id.
export async function getTodayDoseCountByMedication(): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ medication_id: number; total: number }>(
    `SELECT medication_id, SUM(quantity) as total
     FROM medication_doses
     WHERE taken_at >= ?
     GROUP BY medication_id`,
    [todayStart()]
  );
  return Object.fromEntries(rows.map(r => [r.medication_id, r.total]));
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

// Returns total quantity per medication within a date range (for reports).
export async function getDoseCountsInRange(
  fromISO: string,
  toISO: string
): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ medication_id: number; total: number }>(
    `SELECT medication_id, SUM(quantity) as total
     FROM medication_doses
     WHERE taken_at >= ? AND taken_at <= ?
     GROUP BY medication_id`,
    [fromISO, toISO]
  );
  return Object.fromEntries(rows.map(r => [r.medication_id, r.total]));
}

// Returns doses joined with medication info within a date range — used by PDF report.
export async function getDosesInRangeWithMedication(
  fromISO: string,
  toISO: string
): Promise<(Dose & { med_name: string; med_dose: string | null })[]> {
  const db = await getDb();
  return db.getAllAsync<Dose & { med_name: string; med_dose: string | null }>(
    `SELECT d.id, d.medication_id, d.taken_at, d.quantity, d.note, d.updated_at,
            m.name AS med_name, m.dose AS med_dose
     FROM medication_doses d
     JOIN medications m ON d.medication_id = m.id
     WHERE d.taken_at >= ? AND d.taken_at <= ?
     ORDER BY d.taken_at DESC`,
    [fromISO, toISO]
  );
}

// Returns all doses joined with medication name/dose — used by Timeline.
export async function getAllDosesWithMedication(): Promise<
  (Dose & { med_name: string; med_dose: string | null })[]
> {
  const db = await getDb();
  return db.getAllAsync<Dose & { med_name: string; med_dose: string | null }>(
    `SELECT d.id, d.medication_id, d.taken_at, d.quantity, d.note, d.updated_at,
            m.name AS med_name, m.dose AS med_dose
     FROM medication_doses d
     JOIN medications m ON d.medication_id = m.id
     ORDER BY d.taken_at DESC`
  );
}
