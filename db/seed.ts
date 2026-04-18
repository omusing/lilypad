import { getDb } from './client';
import { insertMedication } from './medications';
import { insertEntry } from './entries';
import type { NewEntry } from './schema';

// ─── Reset ────────────────────────────────────────────────────────────────────

export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM medication_doses');
    await db.execAsync('DELETE FROM entries');
    await db.execAsync('DELETE FROM medications');
    await db.runAsync(
      `UPDATE app_settings SET
        patient_name     = NULL,
        onboarding_done  = 0,
        morning_reminder = 0,
        evening_reminder = 0
       WHERE id = 1`
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns an ISO string for N days ago at a given HH:MM
function ts(daysAgo: number, hh: number, mm: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function logDoseAt(medicationId: number, isoTime: string, note?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO medication_doses (medication_id, taken_at, note) VALUES (?, ?, ?)',
    [medicationId, isoTime, note ?? null]
  );
}

async function setName(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE app_settings SET patient_name = ? WHERE id = 1', [name]);
}

// ─── Client A ─────────────────────────────────────────────────────────────────

export async function seedClientA(): Promise<void> {
  await resetDatabase();

  const ibu = await insertMedication({ name: 'Ibuprofen', dose: '200mg', route: 'oral', frequency: 'as needed' });
  await setName('Alex');

  // 20 pseudo-random days across past 30, with pain 3-6 and head region
  const days =  [1,2,3,5,6,8,9,11,12,14,15,17,18,20,21,23,24,26,27,29];
  const pains = [3,5,4,6,3, 5,4, 6, 5, 3, 4, 6, 3, 5, 6, 4, 3, 5, 4, 6];
  const hours = [9,11,14,10,16,9,13,15,10,17,11,14,9,16,10,13,15,11,9,14];
  const mins  = [15,30,0,45,20,0,15,30,45,0,20,10,35,0,50,25,5,40,15,30];

  for (let i = 0; i < 20; i++) {
    const painTime = ts(days[i], hours[i], mins[i]);
    const entry: NewEntry = {
      entry_date:     dateStr(days[i]),
      pain_level:     pains[i],
      pain_regions:   ['head'],
      pain_qualities: [],
      triggers:       [],
      mood:           null,
      sleep_quality:  null,
      medication_ids: [],
      note:           null,
    };
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [entry.entry_date, entry.pain_level, JSON.stringify(entry.pain_regions), painTime]
    );
    // Dose 10-30 min after pain entry
    const doseOffset = [10,15,20,25,12,18,10,22,14,16,20,10,25,12,18,15,20,10,14,22][i];
    const doseTime = new Date(painTime);
    doseTime.setMinutes(doseTime.getMinutes() + doseOffset);
    await logDoseAt(ibu.id, doseTime.toISOString());
  }
}

// ─── Jerry ────────────────────────────────────────────────────────────────────

export async function seedJerry(): Promise<void> {
  await resetDatabase();

  const nap = await insertMedication({ name: 'Naproxen', dose: '220mg', route: 'oral', frequency: 'daily' });
  await setName('Jerry');

  const pains   = [1,2,1,0,2,1,3,1,2,0,1,2,1,3,1,0,2,1,2,1,3,1,0,2,1,2,0,1,2,1];
  const regions = ['legs','knees'];
  const hours   = [8,7,8,9,7,8,8,9,7,8,9,7,8,8,7,9,8,7,8,9,7,8,9,8,7,8,9,7,8,8];
  const mins    = [0,30,15,0,45,20,5,35,10,50,25,0,40,15,55,30,0,45,20,5,35,10,50,25,0,40,15,55,30,0];

  for (let i = 0; i < 30; i++) {
    const daysAgo = 30 - i; // day 30 ago through yesterday
    const painTime = ts(daysAgo, hours[i], mins[i]);
    const region = regions[i % 2];
    await getDb().then(db => db.runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [dateStr(daysAgo), pains[i], JSON.stringify([region]), painTime]
    ));
    // Dose 30-60 min after
    const doseOffset = 30 + (i % 4) * 10;
    const doseTime = new Date(painTime);
    doseTime.setMinutes(doseTime.getMinutes() + doseOffset);
    await logDoseAt(nap.id, doseTime.toISOString());
  }
}

// ─── Micky ────────────────────────────────────────────────────────────────────

export async function seedMicky(): Promise<void> {
  await resetDatabase();

  const meds = await Promise.all([
    insertMedication({ name: 'Tramadol',      dose: '50mg',  route: 'oral',    frequency: 'as needed' }),
    insertMedication({ name: 'Gabapentin',    dose: '300mg', route: 'oral',    frequency: 'as needed' }),
    insertMedication({ name: 'Ibuprofen',     dose: '400mg', route: 'oral',    frequency: 'as needed' }),
    insertMedication({ name: 'Diclofenac',    dose: '25mg',  route: 'topical', frequency: 'as needed' }),
    insertMedication({ name: 'Cyclobenzaprine', dose: '5mg', route: 'oral',    frequency: 'as needed' }),
  ]);
  await setName('Micky');

  // 13 entries, irregular spacing
  const days   = [2,5,8,9,12,14,17,19,21,24,26,28,29];
  const pains  = [5,7,3,0, 6, 4, 7, 3, 5, 6, 0, 4, 7];
  const hours  = [14,9,20,11,16,8,13,19,10,15,21,9,17];
  const mins   = [30,15,0,45,20,0,40,10,55,25,5,35,0];
  // Which medication to log (index into meds), -1 = no dose logged
  const medIdx = [2,0,3,-1,1,4,0,-1,2,1,-1,3,0];
  // Extra dose days with no pain entry (daysAgo, medIdx)
  const extraDoses: [number, number][] = [[3,2],[10,1],[22,4]];

  for (let i = 0; i < 13; i++) {
    const painTime = ts(days[i], hours[i], mins[i]);
    await getDb().then(db => db.runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [dateStr(days[i]), pains[i], JSON.stringify(['abdomen']), painTime]
    ));
    if (medIdx[i] >= 0) {
      const doseTime = new Date(painTime);
      doseTime.setMinutes(doseTime.getMinutes() + 20);
      await logDoseAt(meds[medIdx[i]].id, doseTime.toISOString());
    }
  }

  // Extra doses on days with no pain entry
  for (const [daysAgo, mi] of extraDoses) {
    await logDoseAt(meds[mi].id, ts(daysAgo, 15, 0));
  }
}

// ─── Donny ────────────────────────────────────────────────────────────────────

export async function seedDonny(): Promise<void> {
  await resetDatabase();

  const mtx = await insertMedication({ name: 'Methotrexate',      dose: '2.5mg', route: 'oral', frequency: 'daily AM' });
  const fol = await insertMedication({ name: 'Folic Acid',        dose: '1mg',   route: 'oral', frequency: 'daily AM' });
  const hcq = await insertMedication({ name: 'Hydroxychloroquine', dose: '200mg', route: 'oral', frequency: 'daily PM' });
  await setName('Donny');

  // AM doses: Methotrexate + Folic Acid together, near-daily (skip days 7, 14, 21, 28)
  const amMins = [0,15,5,30,0,20,10,45,0,15,5,25,0,10,20,35,0,15,5,30,0,20,10,45,0,15,5,30];
  let amIdx = 0;
  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    if ([7,14,21,28].includes(daysAgo)) continue; // skip days
    const h = 7 + (amIdx % 2 === 0 ? 0 : 1); // alternate 7am and 8am
    const m = amMins[amIdx % amMins.length];
    const t = ts(daysAgo, h, m);
    await logDoseAt(mtx.id, t);
    await logDoseAt(fol.id, new Date(new Date(t).getTime() + 2 * 60000).toISOString()); // folic acid 2 min later
    amIdx++;
  }

  // PM doses: Hydroxychloroquine, every 1-2 days
  const pmDays = [1,2,4,5,7,9,10,12,13,15,16,18,19,21,22,24,25,27,28,30];
  const pmMins = [0,30,15,45,0,20,50,10,35,5,40,0,25,55,15,30,0,20,45,10];
  for (let i = 0; i < pmDays.length; i++) {
    await logDoseAt(hcq.id, ts(pmDays[i], 18 + (i % 3 === 0 ? 0 : i % 2), pmMins[i]));
  }

  // 5 occasional headache pain entries
  const headDays   = [3, 8, 15, 22, 27];
  const headPains  = [3, 2,  4,  3,  2];
  const headHours  = [14,10,16,11,19];
  const headMins   = [20, 0,45,30, 0];
  for (let i = 0; i < 5; i++) {
    const painTime = ts(headDays[i], headHours[i], headMins[i]);
    await getDb().then(db => db.runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [dateStr(headDays[i]), headPains[i], JSON.stringify(['head']), painTime]
    ));
  }
}
