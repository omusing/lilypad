import { getDb } from './client';
import {
  Medication, MedicationRow, NewMedication, MedicationUpdate, rowToMedication,
} from './schema';

function now(): string {
  return new Date().toISOString();
}

export async function insertMedication(data: NewMedication): Promise<Medication> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO medications (name, dose, route, frequency, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.dose ?? null, data.route ?? null, data.frequency ?? null, now()]
  );
  const row = await db.getFirstAsync<MedicationRow>(
    'SELECT * FROM medications WHERE id = ?', [result.lastInsertRowId]
  );
  return rowToMedication(row!);
}

export async function updateMedication(id: number, data: MedicationUpdate): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (data.name      !== undefined) { fields.push('name = ?');      values.push(data.name); }
  if (data.dose      !== undefined) { fields.push('dose = ?');      values.push(data.dose); }
  if (data.route     !== undefined) { fields.push('route = ?');     values.push(data.route); }
  if (data.frequency !== undefined) { fields.push('frequency = ?'); values.push(data.frequency); }

  if (fields.length === 0) return;
  values.push(String(id));

  await db.runAsync(
    `UPDATE medications SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// No hard delete — archive only (preserves dose history).
export async function archiveMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE medications SET is_active = 0 WHERE id = ?', [id]
  );
}

export async function unarchiveMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE medications SET is_active = 1 WHERE id = ?', [id]
  );
}

export async function getMedications(includeArchived = false): Promise<Medication[]> {
  const db = await getDb();
  const sql = includeArchived
    ? 'SELECT * FROM medications ORDER BY name ASC'
    : 'SELECT * FROM medications WHERE is_active = 1 ORDER BY name ASC';
  const rows = await db.getAllAsync<MedicationRow>(sql);
  return rows.map(rowToMedication);
}

export async function getMedication(id: number): Promise<Medication | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MedicationRow>(
    'SELECT * FROM medications WHERE id = ?', [id]
  );
  return row ? rowToMedication(row) : null;
}
