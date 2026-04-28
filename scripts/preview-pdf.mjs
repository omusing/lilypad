// Run: node scripts/preview-pdf.mjs
// Writes preview.html to the project root and opens it.
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOOD_LABELS  = ['', 'Bad', 'Low', 'Ok', 'Good', 'Great'];
const SLEEP_LABELS = ['', 'Bad', 'Poor', 'Ok', 'Good', 'Great'];

function moodLabel(v)  { return v === null ? '' : `${v} - ${MOOD_LABELS[v] ?? ''}`; }
function sleepLabel(v) { return v === null ? '' : `${v} - ${SLEEP_LABELS[v] ?? ''}`; }

function fmtTime(iso) {
  const d = new Date(iso);
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${ampm}`;
}

function fmtDateShort(isoDate) {
  const [y,mo,d] = isoDate.split('-').map(Number);
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${MONTHS[mo-1]} ${d}, ${y}`;
}

function fmtLongDate(isoDate) {
  const [y,mo,d] = isoDate.split('-').map(Number);
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${MONTHS[mo-1]} ${d}, ${y}`;
}

function fmtDateRange(from, to) {
  const [fy, fmo, fd] = from.split('-').map(Number);
  const [ty, tmo, td] = to.split('-').map(Number);
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const fromPart = fy === ty ? `${MONTHS[fmo-1]} ${fd}` : fmtLongDate(from);
  return `${fromPart} - ${MONTHS[tmo-1]} ${td}, ${ty}`;
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Pain pill SVG ─────────────────────────────────────────────────────────────

let pillCounter = 0;
function painPillSvg(level) {
  pillCounter++;
  const W=52, H=14, R=2;
  const innerW = W-2;
  const fillW = Math.round((level/10)*innerW);
  const clipId = `pc${pillCounter}`;
  let numX, numColor, numAnchor;
  if (level === 0) { numX='5'; numColor='#5F3A00'; numAnchor='start'; }
  else if (level <= 2) { numX=String(1+fillW+3); numColor='#5F3A00'; numAnchor='start'; }
  else { numX=String(1+Math.round(fillW/2)); numColor='#ffffff'; numAnchor='middle'; }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
  <defs><clipPath id="${clipId}"><rect x="1" y="1" width="${innerW}" height="${H-2}" rx="${R}"/></clipPath></defs>
  <rect x="0.75" y="0.75" width="${W-1.5}" height="${H-1.5}" rx="${R}" fill="white" stroke="#A84A42" stroke-width="1.5"/>
  ${fillW > 0 ? `<rect x="1" y="1" width="${fillW}" height="${H-2}" fill="#A84A42" clip-path="url(#${clipId})"/>` : ''}
  <text x="${numX}" y="${Math.round(H/2)+3}" text-anchor="${numAnchor}" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${numColor}">${level}</text>
</svg>`;
}

// ── Chart SVG ─────────────────────────────────────────────────────────────────

function buildChartSvg(entries, days, fromDate) {
  const W=680, H=100, PL=26, PR=10, PT=8, PB=20;
  const chartW=W-PL-PR, chartH=H-PT-PB;
  const peakByDay = {};
  for (const e of entries) {
    if (peakByDay[e.entry_date] === undefined || e.pain_level > peakByDay[e.entry_date])
      peakByDay[e.entry_date] = e.pain_level;
  }
  const [fy,fm,fd] = fromDate.split('-').map(Number);
  const fromMs = new Date(fy,fm-1,fd).getTime();
  const xOf = i => PL + (i/Math.max(days-1,1))*chartW;
  const yOf = p => PT + chartH - (p/10)*chartH;

  const points = [];
  for (const [dateStr, pain] of Object.entries(peakByDay)) {
    const [dy,dm,dd] = dateStr.split('-').map(Number);
    const idx = Math.round((new Date(dy,dm-1,dd).getTime()-fromMs)/86400000);
    if (idx>=0 && idx<days) points.push({idx,pain});
  }
  points.sort((a,b)=>a.idx-b.idx);

  const segs = []; let cur = [];
  for (let i=0;i<points.length;i++) {
    if (i===0||points[i].idx!==points[i-1].idx+1) { if(cur.length) segs.push(cur); cur=[points[i]]; }
    else cur.push(points[i]);
  }
  if (cur.length) segs.push(cur);

  const gridLines = [0,2,4,6,8,10].map(v => {
    const y=yOf(v);
    return `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W-PR}" y2="${y.toFixed(1)}" stroke="#B8CCC6" stroke-width="0.8"/>
<text x="${PL-3}" y="${(y+3.5).toFixed(1)}" text-anchor="end" font-family="Arial,sans-serif" font-size="8" fill="#3A4A44">${v}</text>`;
  }).join('\n');

  const labelIdxs = new Set();
  for (let i=0;i<days;i+=5) labelIdxs.add(i);
  labelIdxs.add(days-1);
  const xLabels = [...labelIdxs].sort((a,b)=>a-b).map(i => {
    const x=xOf(i), d=new Date(fromMs+i*86400000);
    return `<text x="${x.toFixed(1)}" y="${H-4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" fill="#3A4A44">${d.getMonth()+1}/${d.getDate()}</text>`;
  }).join('\n');

  const polylines = segs.map(seg => {
    if (seg.length===1) return `<circle cx="${xOf(seg[0].idx).toFixed(1)}" cy="${yOf(seg[0].pain).toFixed(1)}" r="2" fill="#A84A42"/>`;
    const pts = seg.map(p=>`${xOf(p.idx).toFixed(1)},${yOf(p.pain).toFixed(1)}`).join(' ');
    const dots = seg.map(p=>`<circle cx="${xOf(p.idx).toFixed(1)}" cy="${yOf(p.pain).toFixed(1)}" r="2" fill="#A84A42"/>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="#A84A42" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('\n');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;display:block;">
${gridLines}${polylines}${xLabels}
</svg>`;
}

// ── Med chips ─────────────────────────────────────────────────────────────────

function buildMedChips(meds) {
  if (!meds.length) return '<p style="font-style:italic;color:#4A5C55;font-size:9pt;margin:0;">No active medications on record.</p>';
  return meds.map(m => {
    const nameDose = esc(`${m.name}${m.dose ? ' '+m.dose : ''}`);
    const sub = [m.frequency, m.route].filter(Boolean).join(' · ');
    return `<span class="med-chip"><span class="med-chip-name">${nameDose}</span>${sub ? `<span class="med-chip-sub">${esc(sub)}</span>` : ''}</span>`;
  }).join('');
}

// ── Table rows ────────────────────────────────────────────────────────────────

function buildTableRows(rows) {
  pillCounter = 0;

  // Group rows by date
  const groups = [];
  for (const row of rows) {
    const date = row.kind==='pain' ? row.entry.entry_date : row.dose.taken_at.slice(0,10);
    const last = groups[groups.length-1];
    if (last && last.date === date) { last.rows.push(row); }
    else { groups.push({ date, rows: [row] }); }
  }

  let html = '';
  for (const group of groups) {
    const dateLabel = esc(fmtDateShort(group.date));
    html += `</tbody><tbody class="date-group">
<tr class="date-sep-row">
  <td colspan="8"><span class="date-sep-label">${dateLabel}</span></td>
</tr>\n`;

    for (const row of group.rows) {
      if (row.kind === 'pain') {
        const e = row.entry;
        const timeStr = fmtTime(e.created_at);
        html += `<tr class="pain-row">
  <td><div class="time-label">${esc(timeStr)}</div></td>
  <td>${painPillSvg(e.pain_level)}</td>
  <td>${esc(e.pain_regions.join(', '))}</td>
  <td>${esc(e.pain_qualities.join(', '))}</td>
  <td>${esc(e.triggers.join(', '))}</td>
  <td>${esc(moodLabel(e.mood))}</td>
  <td>${esc(sleepLabel(e.sleep_quality))}</td>
  <td>${e.note ? esc(e.note) : ''}</td>
</tr>\n`;
      } else {
        const d = row.dose;
        const timeStr = fmtTime(d.taken_at);
        const medName = esc(`${d.med_name}${d.med_dose ? ' '+d.med_dose : ''}`);
        const qty = d.quantity > 1 ? ` &times;${d.quantity}` : '';
        html += `<tr class="dose-row">
  <td><div class="time-label">${esc(timeStr)}</div></td>
  <td></td>
  <td colspan="2">${medName}${qty}</td>
  <td>-</td>
  <td>-</td>
  <td>-</td>
  <td>${d.note ? esc(d.note) : ''}</td>
</tr>\n`;
      }
    }
  }
  return html.replace(/^<\/tbody><tbody class="date-group">\n/, '');
}

// ── Profiles ──────────────────────────────────────────────────────────────────

const PROFILES = {

  jane: {
    patientName: 'Jane Smith',
    today: '2026-04-27',
    from:  '2026-03-29',
    meds: [
      { id:1, name:'Naproxen',   dose:'220mg',  route:'oral',    frequency:'as needed', is_active:true },
      { id:2, name:'Gabapentin', dose:'300mg',  route:'oral',    frequency:'nightly',   is_active:true },
      { id:3, name:'Diclofenac', dose:'1% gel', route:'topical', frequency:'as needed', is_active:true },
    ],
    entries: [
      { id:1,  entry_date:'2026-04-27', pain_level:4, pain_regions:['head','neck'],      pain_qualities:['Dull','Pressure'],  triggers:['Stress'],           mood:3, sleep_quality:3, note:null,                   created_at:'2026-04-27T09:15:00' },
      { id:2,  entry_date:'2026-04-27', pain_level:6, pain_regions:['neck'],             pain_qualities:['Sharp'],            triggers:['Poor sleep'],       mood:2, sleep_quality:2, note:'Got worse after lunch', created_at:'2026-04-27T14:30:00' },
      { id:3,  entry_date:'2026-04-25', pain_level:5, pain_regions:['lower-back'],       pain_qualities:['Aching'],           triggers:['Physical activity'],mood:3, sleep_quality:4, note:null,                   created_at:'2026-04-25T08:00:00' },
      { id:4,  entry_date:'2026-04-23', pain_level:3, pain_regions:['hips'],             pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:null,                   created_at:'2026-04-23T11:20:00' },
      { id:5,  entry_date:'2026-04-21', pain_level:7, pain_regions:['head','shoulders'], pain_qualities:['Throbbing'],        triggers:['Stress','Weather'],  mood:1, sleep_quality:1, note:'Migraine, stayed in bed', created_at:'2026-04-21T07:45:00' },
      { id:6,  entry_date:'2026-04-19', pain_level:2, pain_regions:['neck'],             pain_qualities:['Tight'],            triggers:[],                   mood:4, sleep_quality:5, note:null,                   created_at:'2026-04-19T16:00:00' },
      { id:7,  entry_date:'2026-04-17', pain_level:5, pain_regions:['lower-back'],       pain_qualities:['Sharp','Aching'],   triggers:['Physical activity'],mood:3, sleep_quality:3, note:null,                   created_at:'2026-04-17T10:30:00' },
      { id:8,  entry_date:'2026-04-15', pain_level:4, pain_regions:['head'],             pain_qualities:['Pressure'],         triggers:['Stress'],           mood:3, sleep_quality:3, note:null,                   created_at:'2026-04-15T13:00:00' },
      { id:9,  entry_date:'2026-04-13', pain_level:6, pain_regions:['shoulders','neck'], pain_qualities:['Aching'],           triggers:['Weather'],          mood:2, sleep_quality:2, note:null,                   created_at:'2026-04-13T09:00:00' },
      { id:10, entry_date:'2026-04-11', pain_level:3, pain_regions:['hips'],             pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:null,                   created_at:'2026-04-11T15:00:00' },
      { id:11, entry_date:'2026-04-09', pain_level:5, pain_regions:['lower-back'],       pain_qualities:['Sharp'],            triggers:['Physical activity'],mood:3, sleep_quality:3, note:'After morning walk',    created_at:'2026-04-09T08:30:00' },
      { id:12, entry_date:'2026-04-07', pain_level:4, pain_regions:['head'],             pain_qualities:['Throbbing'],        triggers:['Stress'],           mood:2, sleep_quality:3, note:null,                   created_at:'2026-04-07T19:00:00' },
      { id:13, entry_date:'2026-04-05', pain_level:2, pain_regions:['neck'],             pain_qualities:['Tight'],            triggers:[],                   mood:5, sleep_quality:5, note:null,                   created_at:'2026-04-05T11:00:00' },
      { id:14, entry_date:'2026-04-03', pain_level:6, pain_regions:['head','neck'],      pain_qualities:['Pressure','Sharp'], triggers:['Stress','Poor sleep'],mood:2,sleep_quality:1, note:'Very bad day',         created_at:'2026-04-03T08:00:00' },
      { id:15, entry_date:'2026-04-01', pain_level:4, pain_regions:['lower-back'],       pain_qualities:['Aching'],           triggers:[],                   mood:3, sleep_quality:3, note:null,                   created_at:'2026-04-01T14:00:00' },
      { id:16, entry_date:'2026-03-30', pain_level:3, pain_regions:['hips'],             pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:null,                   created_at:'2026-03-30T10:00:00' },
      { id:17, entry_date:'2026-03-29', pain_level:5, pain_regions:['head','neck'],      pain_qualities:['Throbbing'],        triggers:['Stress'],           mood:2, sleep_quality:2, note:null,                   created_at:'2026-03-29T17:00:00' },
    ],
    doses: [
      { id:1,  medication_id:1, taken_at:'2026-04-27T09:30:00', quantity:1, note:null,                      med_name:'Naproxen',   med_dose:'220mg' },
      { id:2,  medication_id:2, taken_at:'2026-04-27T21:00:00', quantity:1, note:null,                      med_name:'Gabapentin', med_dose:'300mg' },
      { id:3,  medication_id:1, taken_at:'2026-04-25T08:15:00', quantity:1, note:null,                      med_name:'Naproxen',   med_dose:'220mg' },
      { id:4,  medication_id:3, taken_at:'2026-04-23T11:30:00', quantity:1, note:null,                      med_name:'Diclofenac', med_dose:'1% gel' },
      { id:5,  medication_id:1, taken_at:'2026-04-21T08:00:00', quantity:2, note:'Double dose for migraine', med_name:'Naproxen',   med_dose:'220mg' },
      { id:6,  medication_id:2, taken_at:'2026-04-21T21:00:00', quantity:1, note:null,                      med_name:'Gabapentin', med_dose:'300mg' },
      { id:7,  medication_id:1, taken_at:'2026-04-17T10:45:00', quantity:1, note:null,                      med_name:'Naproxen',   med_dose:'220mg' },
      { id:8,  medication_id:2, taken_at:'2026-04-13T21:00:00', quantity:1, note:null,                      med_name:'Gabapentin', med_dose:'300mg' },
      { id:9,  medication_id:1, taken_at:'2026-04-09T08:45:00', quantity:1, note:null,                      med_name:'Naproxen',   med_dose:'220mg' },
      { id:10, medication_id:3, taken_at:'2026-04-03T08:15:00', quantity:2, note:null,                      med_name:'Diclofenac', med_dose:'1% gel' },
    ],
  },

  michael: {
    patientName: 'Michael Torres',
    today: '2026-04-27',
    from:  '2026-03-29',
    meds: [
      { id:1, name:'Cyclobenzaprine', dose:'10mg',  route:'oral',    frequency:'as needed', is_active:true },
      { id:2, name:'Ibuprofen',       dose:'400mg', route:'oral',    frequency:'as needed', is_active:true },
      { id:3, name:'Methocarbamol',   dose:'750mg', route:'oral',    frequency:'as needed', is_active:true },
    ],
    // 1-2 pain entries per day, 30 days, pain 0-10, mood/sleep 1-5 all values, doses 1-3
    entries: [
      { id:1,  entry_date:'2026-04-27', pain_level:5, pain_regions:['lower-back'],         pain_qualities:['Aching','Tight'],   triggers:['Physical activity'],mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-27T07:30:00' },
      { id:2,  entry_date:'2026-04-27', pain_level:4, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:'Better after stretching', created_at:'2026-04-27T17:00:00' },
      { id:3,  entry_date:'2026-04-26', pain_level:9, pain_regions:['lower-back','legs'],  pain_qualities:['Sharp','Shooting'], triggers:['Physical activity'],mood:1, sleep_quality:1, note:'Bad spasm episode',      created_at:'2026-04-26T08:00:00' },
      { id:4,  entry_date:'2026-04-25', pain_level:7, pain_regions:['lower-back','legs'],  pain_qualities:['Sharp'],            triggers:['Physical activity'],mood:2, sleep_quality:2, note:'Referred pain to leg',    created_at:'2026-04-25T09:15:00' },
      { id:5,  entry_date:'2026-04-24', pain_level:6, pain_regions:['lower-back','hips'],  pain_qualities:['Tight','Aching'],   triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-24T07:45:00' },
      { id:6,  entry_date:'2026-04-24', pain_level:5, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-24T19:00:00' },
      { id:7,  entry_date:'2026-04-23', pain_level:8, pain_regions:['lower-back','legs'],  pain_qualities:['Sharp','Shooting'], triggers:['Physical activity'],mood:1, sleep_quality:1, note:'Worst this week',        created_at:'2026-04-23T08:30:00' },
      { id:8,  entry_date:'2026-04-22', pain_level:6, pain_regions:['lower-back'],         pain_qualities:['Aching','Tight'],   triggers:['Sitting long'],     mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-22T09:00:00' },
      { id:9,  entry_date:'2026-04-21', pain_level:4, pain_regions:['lower-back','hips'],  pain_qualities:['Aching'],           triggers:[],                   mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-21T08:00:00' },
      { id:10, entry_date:'2026-04-21', pain_level:2, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:'Felt better after walk',  created_at:'2026-04-21T18:00:00' },
      { id:11, entry_date:'2026-04-20', pain_level:0, pain_regions:[],                     pain_qualities:[],                   triggers:[],                   mood:5, sleep_quality:5, note:'Pain-free day',           created_at:'2026-04-20T10:00:00' },
      { id:12, entry_date:'2026-04-19', pain_level:5, pain_regions:['lower-back','hips'],  pain_qualities:['Tight','Aching'],   triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-19T08:15:00' },
      { id:13, entry_date:'2026-04-18', pain_level:4, pain_regions:['lower-back'],         pain_qualities:['Dull','Aching'],    triggers:[],                   mood:3, sleep_quality:4, note:null,                    created_at:'2026-04-18T09:00:00' },
      { id:14, entry_date:'2026-04-17', pain_level:6, pain_regions:['lower-back','legs'],  pain_qualities:['Sharp'],            triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-17T07:30:00' },
      { id:15, entry_date:'2026-04-16', pain_level:5, pain_regions:['lower-back'],         pain_qualities:['Aching','Tight'],   triggers:['Sitting long'],     mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-16T09:30:00' },
      { id:16, entry_date:'2026-04-15', pain_level:3, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:null,                    created_at:'2026-04-15T08:00:00' },
      { id:17, entry_date:'2026-04-14', pain_level:5, pain_regions:['lower-back','hips'],  pain_qualities:['Aching'],           triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-14T07:45:00' },
      { id:18, entry_date:'2026-04-13', pain_level:4, pain_regions:['lower-back'],         pain_qualities:['Dull','Tight'],     triggers:[],                   mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-13T09:00:00' },
      { id:19, entry_date:'2026-04-12', pain_level:2, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:5, sleep_quality:5, note:'Good day',               created_at:'2026-04-12T10:00:00' },
      { id:20, entry_date:'2026-04-11', pain_level:6, pain_regions:['lower-back','hips'],  pain_qualities:['Aching','Sharp'],   triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-11T08:15:00' },
      { id:21, entry_date:'2026-04-10', pain_level:8, pain_regions:['lower-back','legs'],  pain_qualities:['Shooting','Tight'], triggers:['Physical activity'],mood:1, sleep_quality:1, note:'Severe flare-up',         created_at:'2026-04-10T07:30:00' },
      { id:22, entry_date:'2026-04-09', pain_level:5, pain_regions:['lower-back'],         pain_qualities:['Aching'],           triggers:['Sitting long'],     mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-09T09:00:00' },
      { id:23, entry_date:'2026-04-08', pain_level:4, pain_regions:['lower-back','hips'],  pain_qualities:['Dull','Aching'],    triggers:[],                   mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-08T08:30:00' },
      { id:24, entry_date:'2026-04-07', pain_level:5, pain_regions:['lower-back'],         pain_qualities:['Tight','Aching'],   triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-07T07:45:00' },
      { id:25, entry_date:'2026-04-06', pain_level:3, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:null,                    created_at:'2026-04-06T09:00:00' },
      { id:26, entry_date:'2026-04-05', pain_level:1, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:5, sleep_quality:5, note:'Almost pain-free',        created_at:'2026-04-05T10:00:00' },
      { id:27, entry_date:'2026-04-04', pain_level:5, pain_regions:['lower-back','hips'],  pain_qualities:['Aching','Tight'],   triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-04-04T08:00:00' },
      { id:28, entry_date:'2026-04-03', pain_level:7, pain_regions:['lower-back','legs'],  pain_qualities:['Sharp','Shooting'], triggers:['Physical activity'],mood:1, sleep_quality:1, note:'Bad morning',             created_at:'2026-04-03T07:30:00' },
      { id:29, entry_date:'2026-04-02', pain_level:5, pain_regions:['lower-back'],         pain_qualities:['Aching'],           triggers:['Sitting long'],     mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-02T09:00:00' },
      { id:30, entry_date:'2026-04-01', pain_level:4, pain_regions:['lower-back','hips'],  pain_qualities:['Dull','Aching'],    triggers:[],                   mood:3, sleep_quality:3, note:null,                    created_at:'2026-04-01T08:30:00' },
      { id:31, entry_date:'2026-03-31', pain_level:6, pain_regions:['lower-back'],         pain_qualities:['Aching','Tight'],   triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-03-31T07:45:00' },
      { id:32, entry_date:'2026-03-30', pain_level:4, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:3, sleep_quality:3, note:null,                    created_at:'2026-03-30T09:00:00' },
      { id:33, entry_date:'2026-03-30', pain_level:2, pain_regions:['lower-back'],         pain_qualities:['Dull'],             triggers:[],                   mood:4, sleep_quality:4, note:'Evening - improved',      created_at:'2026-03-30T18:30:00' },
      { id:34, entry_date:'2026-03-29', pain_level:5, pain_regions:['lower-back','hips'],  pain_qualities:['Aching','Sharp'],   triggers:['Physical activity'],mood:2, sleep_quality:2, note:null,                    created_at:'2026-03-29T08:00:00' },
    ],
    // Daily doses rotating between 3 meds, quantities 1-3
    doses: [
      { id:1,  medication_id:2, taken_at:'2026-04-27T07:30:00', quantity:2, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:2,  medication_id:3, taken_at:'2026-04-27T13:00:00', quantity:1, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:3,  medication_id:1, taken_at:'2026-04-26T08:00:00', quantity:3, note:'Severe spasm',     med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:4,  medication_id:2, taken_at:'2026-04-26T14:00:00', quantity:2, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:5,  medication_id:2, taken_at:'2026-04-25T09:00:00', quantity:2, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:6,  medication_id:3, taken_at:'2026-04-24T07:45:00', quantity:1, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:7,  medication_id:2, taken_at:'2026-04-24T14:00:00', quantity:2, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:8,  medication_id:1, taken_at:'2026-04-23T08:30:00', quantity:3, note:'Before work',      med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:9,  medication_id:3, taken_at:'2026-04-23T14:00:00', quantity:2, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:10, medication_id:2, taken_at:'2026-04-22T09:00:00', quantity:1, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:11, medication_id:1, taken_at:'2026-04-21T08:00:00', quantity:1, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:12, medication_id:3, taken_at:'2026-04-19T08:15:00', quantity:2, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:13, medication_id:1, taken_at:'2026-04-18T09:00:00', quantity:1, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:14, medication_id:3, taken_at:'2026-04-17T07:30:00', quantity:1, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:15, medication_id:2, taken_at:'2026-04-17T14:00:00', quantity:2, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:16, medication_id:1, taken_at:'2026-04-16T09:30:00', quantity:1, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:17, medication_id:2, taken_at:'2026-04-15T08:00:00', quantity:1, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:18, medication_id:3, taken_at:'2026-04-14T07:45:00', quantity:2, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:19, medication_id:1, taken_at:'2026-04-13T09:00:00', quantity:1, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:20, medication_id:2, taken_at:'2026-04-12T10:00:00', quantity:1, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:21, medication_id:3, taken_at:'2026-04-11T08:15:00', quantity:2, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:22, medication_id:1, taken_at:'2026-04-10T07:30:00', quantity:3, note:'Flare-up dose',    med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:23, medication_id:2, taken_at:'2026-04-09T09:00:00', quantity:1, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:24, medication_id:3, taken_at:'2026-04-08T08:30:00', quantity:2, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:25, medication_id:1, taken_at:'2026-04-07T07:45:00', quantity:1, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:26, medication_id:2, taken_at:'2026-04-06T09:00:00', quantity:1, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:27, medication_id:3, taken_at:'2026-04-05T10:00:00', quantity:1, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:28, medication_id:1, taken_at:'2026-04-04T08:00:00', quantity:2, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:29, medication_id:2, taken_at:'2026-04-03T07:30:00', quantity:2, note:'Taken before work',med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:30, medication_id:3, taken_at:'2026-04-03T13:00:00', quantity:1, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:31, medication_id:1, taken_at:'2026-04-02T09:00:00', quantity:1, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:32, medication_id:2, taken_at:'2026-04-01T08:30:00', quantity:2, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
      { id:33, medication_id:3, taken_at:'2026-03-31T07:45:00', quantity:1, note:null,               med_name:'Methocarbamol',   med_dose:'750mg' },
      { id:34, medication_id:1, taken_at:'2026-03-30T09:00:00', quantity:1, note:null,               med_name:'Cyclobenzaprine', med_dose:'10mg' },
      { id:35, medication_id:2, taken_at:'2026-03-29T08:00:00', quantity:2, note:null,               med_name:'Ibuprofen',       med_dose:'400mg' },
    ],
  },
};

// Select profile via CLI arg: node preview-pdf.mjs michael
const profileKey = process.argv[2] || 'jane';
const P = PROFILES[profileKey] || PROFILES.jane;
const { patientName: PATIENT, today: TODAY, from: FROM, meds: MEDS, entries: ENTRIES, doses: DOSES } = P;

// ── Build timeline rows ───────────────────────────────────────────────────────

const rows = [
  ...ENTRIES.map(e => ({ kind:'pain', entry:e })),
  ...DOSES.map(d   => ({ kind:'dose', dose:d  })),
];
rows.sort((a,b) => {
  const da = a.kind==='pain' ? a.entry.entry_date : a.dose.taken_at.slice(0,10);
  const db = b.kind==='pain' ? b.entry.entry_date : b.dose.taken_at.slice(0,10);
  if (da!==db) return db.localeCompare(da);
  const ta = a.kind==='pain' ? a.entry.created_at : a.dose.taken_at;
  const tb = b.kind==='pain' ? b.entry.created_at : b.dose.taken_at;
  return tb.localeCompare(ta);
});

// ── Build HTML ────────────────────────────────────────────────────────────────

const chartSvg  = buildChartSvg(ENTRIES, 30, FROM);
const medChips  = buildMedChips(MEDS);
const tableRows = buildTableRows(rows);
const footerPt  = PATIENT;
const footerDate = fmtLongDate(TODAY);

const paginatorScript = '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>PDF Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Screen: simulate US Letter pages with a gray background */
body {
  font-family: 'Source Sans 3', Arial, Helvetica, sans-serif;
  font-size: 9pt;
  color: #1C2523;
  background: #888;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page-wrap {
  width: 8.5in;
  min-height: 11in;
  background: #fff;
  margin: 20px auto;
  padding: 0.5in;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
}

@media print {
  body { background: #fff; }
  .page-wrap { margin: 0; padding: 0.5in; box-shadow: none; width: auto; }
  @page { size: letter portrait; margin: 0.5in; }
}

.report-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 12pt; padding-bottom: 8pt; border-bottom: 1.5px solid #CFDED8;
}
.report-title { font-family:'Lora',Georgia,serif; font-size:18pt; font-weight:600; color:#1C2523; line-height:1.15; margin-bottom:2pt; }
.report-patient { font-size:11pt; font-weight:600; color:#1C2523; margin-bottom:2pt; }
.report-period { font-size:8.5pt; color:#3A4A44; }
.report-brand { font-family:'Lora',Georgia,serif; font-size:11pt; font-weight:600; color:#2E7D5E; }
.report-brand-sub { font-size:8pt; color:#3A4A44; margin-top:1pt; }
.report-generated { font-size:8pt; color:#6B7C73; margin-top:5pt; }

.section-label { font-size:7.5pt; font-weight:700; color:#3A4A44; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:5pt; }

.med-chips { display:flex; flex-wrap:wrap; gap:6pt; }
.med-chip { display:inline-flex; flex-direction:column; border:1px solid #CFDED8; border-radius:6pt; padding:4pt 8pt; background:#F5FAF6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.med-chip-name { font-weight:700; font-size:9pt; color:#2E7D5E; }
.med-chip-sub { font-size:8pt; color:#3A4A44; margin-top:1pt; }

table { width:100%; border-collapse:collapse; font-size:8.5pt; table-layout:fixed; }

thead th {
  background:transparent; color:#1C2523; padding:5pt 5pt; text-align:left;
  font-weight:700; font-size:7.5pt; letter-spacing:0.3px;
  border-bottom:1.5px solid #1C2523;
}

col.c-dt       { width:14%; }
col.c-level    { width:8%;  }
col.c-region   { width:13%; }
col.c-quality  { width:10%; }
col.c-triggers { width:16%; }
col.c-mood     { width:9%;  }
col.c-sleep    { width:9%;  }
col.c-notes    { width:21%; }

tbody.date-group { break-inside:avoid; page-break-inside:avoid; }
tbody tr { page-break-inside:avoid; break-inside:avoid; }

.date-sep-row td {
  padding:0 6pt; border-top:1.5px solid #8a9c95; background:transparent;
  position:relative; height:0; line-height:0; overflow:visible;
}
.date-sep-label {
  position:absolute; top:-0.6em; left:5pt;
  font-size:7.5pt; font-weight:700; color:#1C2523;
  background:transparent; padding:0; white-space:nowrap; line-height:1;
  text-shadow:-2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff,
              -2px 0 0 #fff, 2px 0 0 #fff, 0 -2px 0 #fff, 0 2px 0 #fff;
}
/* Extra breathing room on the rows flanking each date separator */
tbody.date-group tr:last-child td { padding-bottom: 7pt; }
.date-sep-row + tr td { padding-top: 7pt; }

.pain-row { background:#F6EAE8; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.pain-row td { border-bottom:1px solid #EDD8D6; }
.dose-row { background:#ffffff; font-style:italic; color:#4A5C55; }
.dose-row td { border-bottom:1px solid #D0DFDA; }

td { padding:4pt 5pt; vertical-align:top; overflow-wrap:break-word; }

.time-label     { font-size:7.5pt; color:#5A3A36; }
.dose-row .time-label { color:#4A5C55; }

.footer { font-size:7pt; color:#6B7C73; display:flex; justify-content:space-between; padding-top:3pt; margin-top:10pt; border-top:1px solid #CFDED8; }

@media print {
  .footer { position:fixed; bottom:0; left:0; right:0; background:#fff; padding:3pt 0; margin:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { padding-bottom:18pt; }
}
</style>
</head>
<body>
<div class="page-wrap">

<div class="report-header">
  <div>
    <div class="report-title">Pain &amp; Medication Report</div>
    <div class="report-patient">${PATIENT}</div>
    <div class="report-period">${fmtDateRange(FROM, TODAY)}</div>
  </div>
  <div style="text-align:right;padding-left:20pt;flex-shrink:0;">
    <div class="report-brand">Lilypad</div>
    <div class="report-brand-sub">ThePainNP</div>
    <div class="report-generated">Generated ${fmtLongDate(TODAY)}</div>
  </div>
</div>

<div style="margin-bottom:10pt;padding-bottom:8pt;border-bottom:1px solid #CFDED8;">
  <div class="section-label">Active Medications</div>
  <div class="med-chips">${medChips}</div>
</div>

<div style="margin-bottom:10pt;padding-bottom:8pt;border-bottom:1px solid #CFDED8;">
  <div class="section-label">Pain Trend - Daily Peak</div>
  <div style="overflow:hidden;">${chartSvg}</div>
</div>

<div class="section-label" style="margin-bottom:4pt;">Pain &amp; Medication Timeline</div>
<table id="timeline-table">
  <colgroup>
    <col class="c-dt"/><col class="c-level"/><col class="c-region"/><col class="c-quality"/>
    <col class="c-triggers"/><col class="c-mood"/><col class="c-sleep"/><col class="c-notes"/>
  </colgroup>
  <thead>
    <tr>
      <th>Date &amp; Time</th><th>Level</th><th>Region</th><th>Quality</th>
      <th>Triggers</th><th>Mood</th><th>Sleep</th><th>Notes</th>
    </tr>
  </thead>
  <tbody>
${tableRows}</tbody>
</table>

<div class="footer">
  <span>Lilypad is a personal logging tool, not a medical record. For clinical use by ${footerPt}'s provider only.</span>
  <span>${footerPt} &middot; ${footerDate}</span>
</div>

</div>${paginatorScript}
</body>
</html>`;

writeFileSync('preview.html', html);
console.log('Written: preview.html');
try { execSync('start preview.html', {stdio:'inherit'}); } catch(e) {}
