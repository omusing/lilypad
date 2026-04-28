import { getDb } from './client';
import { insertMedication } from './medications';

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

async function logDoseAt(
  medicationId: number,
  isoTime: string,
  quantity = 1,
  note?: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO medication_doses (medication_id, taken_at, quantity, note) VALUES (?, ?, ?, ?)',
    [medicationId, isoTime, quantity, note ?? null]
  );
}

async function setName(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE app_settings SET patient_name = ? WHERE id = 1', [name]);
}

// ─── Client A ─────────────────────────────────────────────────────────────────
// 30-day history. Head pain 3-6. Ibuprofen 200mg as needed.
// Typically takes 2 tablets at a time — realistic OTC dosing.

export async function seedClientA(): Promise<void> {
  await resetDatabase();

  const ibu = await insertMedication({ name: 'Ibuprofen', dose: '200mg', route: 'oral', frequency: 'as needed' });
  await setName('Alex');

  const days =  [1,2,3,5,6,8,9,11,12,14,15,17,18,20,21,23,24,26,27,29];
  const pains = [3,5,4,6,3, 5,4, 6, 5, 3, 4, 6, 3, 5, 6, 4, 3, 5, 4, 6];
  const hours = [9,11,14,10,16,9,13,15,10,17,11,14,9,16,10,13,15,11,9,14];
  const mins  = [15,30,0,45,20,0,15,30,45,0,20,10,35,0,50,25,5,40,15,30];

  for (let i = 0; i < 20; i++) {
    const painTime = ts(days[i], hours[i], mins[i]);
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [dateStr(days[i]), pains[i], JSON.stringify(['head']), painTime]
    );
    const doseOffset = [10,15,20,25,12,18,10,22,14,16,20,10,25,12,18,15,20,10,14,22][i];
    const doseTime = new Date(painTime);
    doseTime.setMinutes(doseTime.getMinutes() + doseOffset);
    // Takes 2 tablets for moderate-severe pain (≥5), 1 for mild
    const qty = pains[i] >= 5 ? 2 : 1;
    await logDoseAt(ibu.id, doseTime.toISOString(), qty);
  }
}

// ─── Jerry ────────────────────────────────────────────────────────────────────
// Mild, daily, consistent. Naproxen 220mg once daily — always 1 tablet.

export async function seedJerry(): Promise<void> {
  await resetDatabase();

  const nap = await insertMedication({ name: 'Naproxen', dose: '220mg', route: 'oral', frequency: 'daily' });
  await setName('Jerry');

  const pains   = [1,2,1,0,2,1,3,1,2,0,1,2,1,3,1,0,2,1,2,1,3,1,0,2,1,2,0,1,2,1];
  const regions = ['legs', 'feet'];
  const hours   = [8,7,8,9,7,8,8,9,7,8,9,7,8,8,7,9,8,7,8,9,7,8,9,8,7,8,9,7,8,8];
  const mins    = [0,30,15,0,45,20,5,35,10,50,25,0,40,15,55,30,0,45,20,5,35,10,50,25,0,40,15,55,30,0];

  for (let i = 0; i < 30; i++) {
    const daysAgo = 30 - i;
    const painTime = ts(daysAgo, hours[i], mins[i]);
    const region = regions[i % 2];
    await (await getDb()).runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [dateStr(daysAgo), pains[i], JSON.stringify([region]), painTime]
    );
    const doseOffset = 30 + (i % 4) * 10;
    const doseTime = new Date(painTime);
    doseTime.setMinutes(doseTime.getMinutes() + doseOffset);
    await logDoseAt(nap.id, doseTime.toISOString(), 1);
  }
}

// ─── Micky ────────────────────────────────────────────────────────────────────
// High-variance, irregular, multi-medication. Gabapentin 300mg taken as 2 capsules
// (600mg effective dose) — common real-world dosing pattern.

export async function seedMicky(): Promise<void> {
  await resetDatabase();

  const meds = await Promise.all([
    insertMedication({ name: 'Tramadol',        dose: '50mg',  route: 'oral',    frequency: 'as needed' }),
    insertMedication({ name: 'Gabapentin',       dose: '300mg', route: 'oral',    frequency: 'as needed' }),
    insertMedication({ name: 'Ibuprofen',        dose: '400mg', route: 'oral',    frequency: 'as needed' }),
    insertMedication({ name: 'Diclofenac',       dose: '25mg',  route: 'topical', frequency: 'as needed' }),
    insertMedication({ name: 'Cyclobenzaprine',  dose: '5mg',   route: 'oral',    frequency: 'as needed' }),
  ]);
  await setName('Micky');

  const days   = [2,5,8,9,12,14,17,19,21,24,26,28,29];
  const pains  = [5,7,3,0, 6, 4, 7, 3, 5, 6, 0, 4, 7];
  const hours  = [14,9,20,11,16,8,13,19,10,15,21,9,17];
  const mins   = [30,15,0,45,20,0,40,10,55,25,5,35,0];
  const medIdx = [2,0,3,-1,1,4,0,-1,2,1,-1,3,0];
  // Gabapentin (index 1) always taken as 2 capsules
  const qty    = [1,1,1, 0, 2, 1,1, 0,1,2, 0,1,1];

  const extraDoses: [number, number, number][] = [[3,2,1],[10,1,2],[22,4,1]];

  for (let i = 0; i < 13; i++) {
    const painTime = ts(days[i], hours[i], mins[i]);
    await (await getDb()).runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [dateStr(days[i]), pains[i], JSON.stringify(['abdomen']), painTime]
    );
    if (medIdx[i] >= 0) {
      const doseTime = new Date(painTime);
      doseTime.setMinutes(doseTime.getMinutes() + 20);
      await logDoseAt(meds[medIdx[i]].id, doseTime.toISOString(), qty[i]);
    }
  }

  for (const [daysAgo, mi, q] of extraDoses) {
    await logDoseAt(meds[mi].id, ts(daysAgo, 15, 0), q);
  }
}

// ─── Michael ──────────────────────────────────────────────────────────────────
// Daily lower-back pain, 30 days. Rotates between 3 muscle/pain meds.
// Pain spans 0-10. Doses 1-3 per intake. Mood & sleep use full 1-5 range.

export async function seedMichael(): Promise<void> {
  await resetDatabase();

  const cyc = await insertMedication({ name: 'Cyclobenzaprine', dose: '10mg',  route: 'oral', frequency: 'as needed' });
  const ibu = await insertMedication({ name: 'Ibuprofen',       dose: '400mg', route: 'oral', frequency: 'as needed' });
  const mec = await insertMedication({ name: 'Methocarbamol',   dose: '750mg', route: 'oral', frequency: 'as needed' });
  await setName('Michael');

  // One entry per day (daysAgo 1..30), with a second entry on high-pain days
  const dayData: {
    pain: number; regions: string[]; qualities: string[];
    triggers: string[]; mood: number; sleep: number; note: string | null;
    hour: number; min: number;
    pain2?: number; hour2?: number; min2?: number; note2?: string | null;
    medId: number; qty: number; doseOffsetMin: number;
    medId2?: number; qty2?: number; dose2OffsetMin?: number;
  }[] = [
    { pain:5, regions:['lower-back'],         qualities:['Aching','Tight'],   triggers:['Physical activity'], mood:3,sleep:3, note:null,                  hour:7, min:30, pain2:3, hour2:17,min2:0,  note2:'Better after stretching', medId:ibu.id, qty:2, doseOffsetMin:15 },
    { pain:6, regions:['lower-back','hips'],   qualities:['Sharp','Aching'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:8, min:0,                                                              medId:cyc.id, qty:1, doseOffsetMin:20 },
    { pain:4, regions:['lower-back'],          qualities:['Aching'],           triggers:['Sitting long'],      mood:3,sleep:3, note:null,                  hour:9, min:15,                                                             medId:ibu.id, qty:1, doseOffsetMin:10 },
    { pain:5, regions:['lower-back','hips'],   qualities:['Tight','Aching'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:7, min:45, pain2:4, hour2:19,min2:0,  note2:null,                     medId:mec.id, qty:2, doseOffsetMin:15 },
    { pain:9, regions:['lower-back','legs'],   qualities:['Sharp','Shooting'], triggers:['Physical activity'], mood:1,sleep:1, note:'Bad spasm episode',   hour:8, min:30,                                                             medId:cyc.id, qty:3, doseOffsetMin:10, medId2:ibu.id,qty2:2,dose2OffsetMin:240 },
    { pain:6, regions:['lower-back'],          qualities:['Aching','Tight'],   triggers:['Sitting long'],      mood:2,sleep:2, note:null,                  hour:9, min:0,                                                              medId:mec.id, qty:1, doseOffsetMin:20 },
    { pain:5, regions:['lower-back','hips'],   qualities:['Aching'],           triggers:[],                    mood:3,sleep:3, note:null,                  hour:8, min:0,  pain2:3, hour2:18,min2:0,  note2:'Felt better after walk', medId:ibu.id, qty:2, doseOffsetMin:15 },
    { pain:4, regions:['lower-back'],          qualities:['Aching'],           triggers:['Sitting long'],      mood:3,sleep:3, note:null,                  hour:10,min:0,                                                              medId:cyc.id, qty:1, doseOffsetMin:20 },
    { pain:5, regions:['lower-back','hips'],   qualities:['Tight','Aching'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:8, min:15,                                                             medId:mec.id, qty:2, doseOffsetMin:15 },
    { pain:4, regions:['lower-back'],          qualities:['Dull','Aching'],    triggers:[],                    mood:3,sleep:4, note:null,                  hour:9, min:0,                                                              medId:ibu.id, qty:1, doseOffsetMin:10 },
    { pain:8, regions:['lower-back','legs'],   qualities:['Sharp'],            triggers:['Physical activity'], mood:2,sleep:2, note:'Referred pain to leg',hour:7, min:30,                                                             medId:cyc.id, qty:3, doseOffsetMin:10, medId2:mec.id,qty2:1,dose2OffsetMin:180 },
    { pain:5, regions:['lower-back'],          qualities:['Aching','Tight'],   triggers:['Sitting long'],      mood:3,sleep:3, note:null,                  hour:9, min:30,                                                             medId:ibu.id, qty:2, doseOffsetMin:20 },
    { pain:4, regions:['lower-back'],          qualities:['Dull'],             triggers:[],                    mood:3,sleep:3, note:null,                  hour:8, min:0,                                                              medId:mec.id, qty:1, doseOffsetMin:15 },
    { pain:5, regions:['lower-back','hips'],   qualities:['Aching'],           triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:7, min:45,                                                             medId:cyc.id, qty:2, doseOffsetMin:15 },
    { pain:4, regions:['lower-back'],          qualities:['Dull','Tight'],     triggers:[],                    mood:3,sleep:3, note:null,                  hour:9, min:0,                                                              medId:ibu.id, qty:1, doseOffsetMin:20 },
    { pain:2, regions:['lower-back'],          qualities:['Dull'],             triggers:[],                    mood:4,sleep:4, note:'Good day',            hour:10,min:0,                                                              medId:mec.id, qty:1, doseOffsetMin:30 },
    { pain:5, regions:['lower-back','hips'],   qualities:['Aching','Sharp'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:8, min:15,                                                             medId:cyc.id, qty:2, doseOffsetMin:15 },
    { pain:7, regions:['lower-back','legs'],   qualities:['Shooting','Tight'], triggers:['Physical activity'], mood:2,sleep:1, note:null,                  hour:7, min:30,                                                             medId:ibu.id, qty:3, doseOffsetMin:10, medId2:cyc.id,qty2:1,dose2OffsetMin:300 },
    { pain:5, regions:['lower-back'],          qualities:['Aching'],           triggers:['Sitting long'],      mood:3,sleep:3, note:null,                  hour:9, min:0,                                                              medId:mec.id, qty:2, doseOffsetMin:20 },
    { pain:4, regions:['lower-back','hips'],   qualities:['Dull','Aching'],    triggers:[],                    mood:3,sleep:3, note:null,                  hour:8, min:30,                                                             medId:ibu.id, qty:1, doseOffsetMin:10 },
    { pain:5, regions:['lower-back'],          qualities:['Tight','Aching'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:7, min:45,                                                             medId:cyc.id, qty:2, doseOffsetMin:15 },
    { pain:4, regions:['lower-back'],          qualities:['Dull'],             triggers:[],                    mood:3,sleep:3, note:null,                  hour:9, min:0,                                                              medId:mec.id, qty:1, doseOffsetMin:20 },
    { pain:0, regions:['lower-back'],          qualities:[],                   triggers:[],                    mood:5,sleep:5, note:'Pain-free day',       hour:10,min:30,                                                             medId:ibu.id, qty:1, doseOffsetMin:30 },
    { pain:5, regions:['lower-back','hips'],   qualities:['Aching','Tight'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:8, min:0,                                                              medId:cyc.id, qty:2, doseOffsetMin:15 },
    { pain:8, regions:['lower-back','legs'],   qualities:['Sharp','Shooting'], triggers:['Physical activity'], mood:1,sleep:1, note:'Worst this week',     hour:7, min:30,                                                             medId:mec.id, qty:3, doseOffsetMin:10, medId2:ibu.id,qty2:2,dose2OffsetMin:240 },
    { pain:5, regions:['lower-back'],          qualities:['Aching'],           triggers:['Sitting long'],      mood:3,sleep:2, note:null,                  hour:9, min:0,                                                              medId:cyc.id, qty:2, doseOffsetMin:20 },
    { pain:4, regions:['lower-back','hips'],   qualities:['Dull','Aching'],    triggers:[],                    mood:3,sleep:3, note:null,                  hour:8, min:30,                                                             medId:ibu.id, qty:1, doseOffsetMin:10 },
    { pain:6, regions:['lower-back'],          qualities:['Aching','Tight'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:7, min:45,                                                             medId:mec.id, qty:2, doseOffsetMin:15 },
    { pain:4, regions:['lower-back'],          qualities:['Dull'],             triggers:[],                    mood:3,sleep:3, note:null,                  hour:9, min:0,                                                              medId:cyc.id, qty:1, doseOffsetMin:20 },
    { pain:5, regions:['lower-back','hips'],   qualities:['Aching','Sharp'],   triggers:['Physical activity'], mood:2,sleep:2, note:null,                  hour:8, min:0,                                                              medId:ibu.id, qty:2, doseOffsetMin:15 },
  ];

  const db = await getDb();
  for (let i = 0; i < dayData.length; i++) {
    const daysAgo = dayData.length - i; // oldest first
    const d = dayData[i];
    const entryTime = ts(daysAgo, d.hour, d.min);

    await db.runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        dateStr(daysAgo), d.pain,
        JSON.stringify(d.regions),
        d.qualities.length ? JSON.stringify(d.qualities) : null,
        d.triggers.length  ? JSON.stringify(d.triggers)  : null,
        d.mood, d.sleep, d.note, entryTime,
      ]
    );

    if (d.pain2 !== undefined) {
      await db.runAsync(
        `INSERT INTO entries
          (entry_date, pain_level, pain_regions, pain_qualities, triggers,
           mood, sleep_quality, medication_ids, note, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)`,
        [
          dateStr(daysAgo), d.pain2,
          JSON.stringify(d.regions),
          JSON.stringify(['Dull']),
          Math.min(5, d.mood + 1), d.sleep, d.note2 ?? null,
          ts(daysAgo, d.hour2!, d.min2!),
        ]
      );
    }

    const doseTime = new Date(entryTime);
    doseTime.setMinutes(doseTime.getMinutes() + d.doseOffsetMin);
    await logDoseAt(d.medId, doseTime.toISOString(), d.qty);

    if (d.medId2 !== undefined) {
      const dose2Time = new Date(entryTime);
      dose2Time.setMinutes(dose2Time.getMinutes() + d.dose2OffsetMin!);
      await logDoseAt(d.medId2, dose2Time.toISOString(), d.qty2!);
    }
  }
}

// ─── Donny ────────────────────────────────────────────────────────────────────
// Medication-focused, minimal pain logging. Methotrexate 2.5mg — patients commonly
// take 4–6 tablets weekly (prescribed as multiples of 2.5mg). Modelled as 4 tablets
// per dose to reflect real rheumatology dosing.

export async function seedDonny(): Promise<void> {
  await resetDatabase();

  const mtx = await insertMedication({ name: 'Methotrexate',       dose: '2.5mg', route: 'oral', frequency: 'daily AM' });
  const fol = await insertMedication({ name: 'Folic Acid',         dose: '1mg',   route: 'oral', frequency: 'daily AM' });
  const hcq = await insertMedication({ name: 'Hydroxychloroquine', dose: '200mg', route: 'oral', frequency: 'daily PM' });
  await setName('Donny');

  const amMins = [0,15,5,30,0,20,10,45,0,15,5,25,0,10,20,35,0,15,5,30,0,20,10,45,0,15,5,30];
  let amIdx = 0;
  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    if ([7,14,21,28].includes(daysAgo)) continue;
    const h = 7 + (amIdx % 2 === 0 ? 0 : 1);
    const m = amMins[amIdx % amMins.length];
    const t = ts(daysAgo, h, m);
    // MTX: 4 tablets of 2.5mg = 10mg weekly dose (common rheumatology prescription)
    await logDoseAt(mtx.id, t, 4);
    // Folic acid always 1 tablet, taken shortly after MTX
    const folTime = new Date(new Date(t).getTime() + 2 * 60000).toISOString();
    await logDoseAt(fol.id, folTime, 1);
    amIdx++;
  }

  // HCQ: 1 tablet daily PM (200mg)
  const pmDays = [1,2,4,5,7,9,10,12,13,15,16,18,19,21,22,24,25,27,28,30];
  const pmMins = [0,30,15,45,0,20,50,10,35,5,40,0,25,55,15,30,0,20,45,10];
  for (let i = 0; i < pmDays.length; i++) {
    await logDoseAt(hcq.id, ts(pmDays[i], 18 + (i % 3 === 0 ? 0 : i % 2), pmMins[i]), 1);
  }

  // 5 occasional headache pain entries
  const headDays  = [3, 8,15,22,27];
  const headPains = [3, 2, 4, 3, 2];
  const headHours = [14,10,16,11,19];
  const headMins  = [20, 0,45,30, 0];
  for (let i = 0; i < 5; i++) {
    const painTime = ts(headDays[i], headHours[i], headMins[i]);
    await (await getDb()).runAsync(
      `INSERT INTO entries
        (entry_date, pain_level, pain_regions, pain_qualities, triggers,
         mood, sleep_quality, medication_ids, note, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [dateStr(headDays[i]), headPains[i], JSON.stringify(['head']), painTime]
    );
  }
}
