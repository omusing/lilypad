import { getDb } from './client';
import { Settings, SettingsRow, rowToSettings } from './schema';

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const row = await db.getFirstAsync<SettingsRow>(
    'SELECT * FROM app_settings WHERE id = 1'
  );
  if (!row) throw new Error('app_settings row missing — runMigrations() not called');
  return rowToSettings(row);
}

export async function updateSettings(data: Partial<Settings>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.patient_name     !== undefined) { fields.push('patient_name = ?');     values.push(data.patient_name); }
  if (data.morning_reminder !== undefined) { fields.push('morning_reminder = ?'); values.push(data.morning_reminder ? 1 : 0); }
  if (data.morning_time     !== undefined) { fields.push('morning_time = ?');     values.push(data.morning_time); }
  if (data.evening_reminder !== undefined) { fields.push('evening_reminder = ?'); values.push(data.evening_reminder ? 1 : 0); }
  if (data.evening_time     !== undefined) { fields.push('evening_time = ?');     values.push(data.evening_time); }
  if (data.onboarding_done  !== undefined) { fields.push('onboarding_done = ?');  values.push(data.onboarding_done ? 1 : 0); }

  if (fields.length === 0) return;
  values.push(1); // WHERE id = 1

  await db.runAsync(
    `UPDATE app_settings SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}
