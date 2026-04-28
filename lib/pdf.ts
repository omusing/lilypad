import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getEntriesInRange } from '@/db/entries';
import { getDosesInRangeWithMedication } from '@/db/doses';
import { getMedications } from '@/db/medications';
import { getSettings } from '@/db/settings';
import type { Entry, Dose, Medication } from '@/db/schema';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DoseWithMed extends Dose {
  med_name: string;
  med_dose: string | null;
}

type TimelineRow =
  | { kind: 'pain'; entry: Entry }
  | { kind: 'dose'; dose: DoseWithMed };

// ─── Label helpers ────────────────────────────────────────────────────────────

const MOOD_LABELS  = ['', 'Bad', 'Low', 'Ok', 'Good', 'Great'];
const SLEEP_LABELS = ['', 'Bad', 'Poor', 'Ok', 'Good', 'Great'];

function moodLabel(v: number | null): string {
  if (v === null) return '';
  return `${v} - ${MOOD_LABELS[v] ?? ''}`;
}

function sleepLabel(v: number | null): string {
  if (v === null) return '';
  return `${v} - ${SLEEP_LABELS[v] ?? ''}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

// "April 27, 2026" full form for date column
function fmtDateShort(isoDate: string): string {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${MONTHS[mo - 1]} ${d}, ${y}`;
}

function fmtLongDate(isoDate: string): string {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${MONTHS[mo - 1]} ${d}, ${y}`;
}

function fmtDateRange(from: string, to: string): string {
  const [fy, fmo] = from.split('-').map(Number);
  const [ty, tmo, td] = to.split('-').map(Number);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const fd = Number(from.split('-')[2]);
  const fromPart = fy === ty ? `${MONTHS[fmo - 1]} ${fd}` : fmtLongDate(from);
  return `${fromPart} - ${MONTHS[tmo - 1]} ${td}, ${ty}`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateOf(row: TimelineRow): string {
  return row.kind === 'pain' ? row.entry.entry_date : row.dose.taken_at.slice(0, 10);
}

// ─── Filename ─────────────────────────────────────────────────────────────────

function buildFileName(patientName: string | null): string {
  const name = (patientName ?? 'Patient').trim();
  const safe = name.replace(/[/\\:*?"<>|]/g, '_');
  return `${safe} - Pain and Medication Journal - ThePainNP.pdf`;
}

// ─── Pain pill SVG ────────────────────────────────────────────────────────────

// 52x14px — fits the Level column. Each instance needs a unique clip-path id.
let pillCounter = 0;

function painPillSvg(level: number): string {
  pillCounter++;
  const W = 52, H = 14, R = 2;
  const BORDER = '#A84A42';
  const FILL   = '#A84A42';
  const innerW = W - 2;
  const fillW  = Math.round((level / 10) * innerW);
  const clipId = `pc${pillCounter}`;

  let numX: string, numColor: string, numAnchor: string;
  if (level === 0) {
    numX = '5'; numColor = '#5F3A00'; numAnchor = 'start';
  } else if (level <= 2) {
    numX = String(1 + fillW + 3); numColor = '#5F3A00'; numAnchor = 'start';
  } else {
    numX = String(1 + Math.round(fillW / 2)); numColor = '#ffffff'; numAnchor = 'middle';
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
  <defs><clipPath id="${clipId}"><rect x="1" y="1" width="${innerW}" height="${H - 2}" rx="${R}"/></clipPath></defs>
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="${R}" fill="white" stroke="${BORDER}" stroke-width="1.5"/>
  ${fillW > 0 ? `<rect x="1" y="1" width="${fillW}" height="${H - 2}" fill="${FILL}" clip-path="url(#${clipId})"/>` : ''}
  <text x="${numX}" y="${Math.round(H / 2) + 3}" text-anchor="${numAnchor}" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${numColor}">${level}</text>
</svg>`;
}

// ─── Line chart SVG ───────────────────────────────────────────────────────────

function buildChartSvg(entries: Entry[], days: number, fromDate: string): string {
  const W = 680, H = 100;
  const PL = 26, PR = 10, PT = 8, PB = 20;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const peakByDay: Record<string, number> = {};
  for (const e of entries) {
    if (peakByDay[e.entry_date] === undefined || e.pain_level > peakByDay[e.entry_date]) {
      peakByDay[e.entry_date] = e.pain_level;
    }
  }

  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const fromMs = new Date(fy, fm - 1, fd).getTime();

  const xOf = (idx: number) => PL + (idx / Math.max(days - 1, 1)) * chartW;
  const yOf = (pain: number) => PT + chartH - (pain / 10) * chartH;

  const points: { idx: number; pain: number }[] = [];
  for (const [dateStr, pain] of Object.entries(peakByDay)) {
    const [dy, dm, dd] = dateStr.split('-').map(Number);
    const idx = Math.round((new Date(dy, dm - 1, dd).getTime() - fromMs) / 86_400_000);
    if (idx >= 0 && idx < days) points.push({ idx, pain });
  }
  points.sort((a, b) => a.idx - b.idx);

  const segments: { idx: number; pain: number }[][] = [];
  let cur: { idx: number; pain: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || points[i].idx !== points[i - 1].idx + 1) {
      if (cur.length) segments.push(cur);
      cur = [points[i]];
    } else {
      cur.push(points[i]);
    }
  }
  if (cur.length) segments.push(cur);

  const gridLines = [0, 2, 4, 6, 8, 10].map(v => {
    const y = yOf(v);
    return `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="#B8CCC6" stroke-width="0.8"/>
<text x="${PL - 3}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-family="Arial,sans-serif" font-size="8" fill="#3A4A44">${v}</text>`;
  }).join('\n');

  const labelIdxs = new Set<number>();
  for (let i = 0; i < days; i += 5) labelIdxs.add(i);
  labelIdxs.add(days - 1);
  const xLabels = [...labelIdxs].sort((a, b) => a - b).map(i => {
    const x = xOf(i);
    const d = new Date(fromMs + i * 86_400_000);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    return `<text x="${x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" fill="#3A4A44">${label}</text>`;
  }).join('\n');

  const polylines = segments.map(seg => {
    if (seg.length === 1) {
      return `<circle cx="${xOf(seg[0].idx).toFixed(1)}" cy="${yOf(seg[0].pain).toFixed(1)}" r="2" fill="#A84A42"/>`;
    }
    const pts  = seg.map(p => `${xOf(p.idx).toFixed(1)},${yOf(p.pain).toFixed(1)}`).join(' ');
    const dots = seg.map(p =>
      `<circle cx="${xOf(p.idx).toFixed(1)}" cy="${yOf(p.pain).toFixed(1)}" r="2" fill="#A84A42"/>`
    ).join('');
    return `<polyline points="${pts}" fill="none" stroke="#A84A42" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
${dots}`;
  }).join('\n');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;display:block;">
${gridLines}
${polylines}
${xLabels}
</svg>`;
}

// ─── Medication chips ─────────────────────────────────────────────────────────

function buildMedChips(meds: Medication[]): string {
  if (meds.length === 0) {
    return '<p style="font-style:italic;color:#4A5C55;font-size:9pt;margin:0;">No active medications on record.</p>';
  }
  return meds.map(m => {
    const nameDose = escHtml(`${m.name}${m.dose ? ' ' + m.dose : ''}`);
    const sub = [m.frequency, m.route].filter(Boolean).join(' · ');
    return `<span class="med-chip">
  <span class="med-chip-name">${nameDose}</span>${sub ? `
  <span class="med-chip-sub">${escHtml(sub)}</span>` : ''}
</span>`;
  }).join('');
}

// ─── Timeline table rows ──────────────────────────────────────────────────────

// Groups rows by date, emitting one <tbody> per date group.
// Each tbody starts with a date separator row and then all entries/doses for that day.
// Using per-date tbodies gives us break-inside:avoid per group by default,
// while the shared colgroup keeps column widths consistent across all groups.
function buildTableRows(rows: TimelineRow[]): string {
  pillCounter = 0;

  // Group rows by date, preserving sort order
  const groups: Array<{ date: string; rows: TimelineRow[] }> = [];
  for (const row of rows) {
    const date = dateOf(row);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.rows.push(row);
    } else {
      groups.push({ date, rows: [row] });
    }
  }

  let html = '';
  for (const group of groups) {
    const dateLabel = escHtml(fmtDateShort(group.date));
    // Date separator row: full-width, border on top, date text left-aligned
    html += `</tbody><tbody class="date-group">
<tr class="date-sep-row">
  <td colspan="8"><span class="date-sep-label">${dateLabel}</span></td>
</tr>\n`;

    for (const row of group.rows) {
      if (row.kind === 'pain') {
        const e = row.entry;
        const timeStr = fmtTime(e.created_at);
        html += `<tr class="pain-row">
  <td><div class="time-label">${escHtml(timeStr)}</div></td>
  <td>${painPillSvg(e.pain_level)}</td>
  <td>${escHtml(e.pain_regions.join(', '))}</td>
  <td>${escHtml(e.pain_qualities.join(', '))}</td>
  <td>${escHtml(e.triggers.join(', '))}</td>
  <td>${escHtml(moodLabel(e.mood))}</td>
  <td>${escHtml(sleepLabel(e.sleep_quality))}</td>
  <td>${e.note ? escHtml(e.note) : ''}</td>
</tr>\n`;
      } else {
        const d = row.dose;
        const timeStr = fmtTime(d.taken_at);
        const medName = escHtml(`${d.med_name}${d.med_dose ? ' ' + d.med_dose : ''}`);
        const qty = d.quantity > 1 ? ` &times;${d.quantity}` : '';
        html += `<tr class="dose-row">
  <td><div class="time-label">${escHtml(timeStr)}</div></td>
  <td></td>
  <td colspan="2">${medName}${qty}</td>
  <td>-</td>
  <td>-</td>
  <td>-</td>
  <td>${d.note ? escHtml(d.note) : ''}</td>
</tr>\n`;
      }
    }
  }

  // Strip the leading </tbody><tbody class="date-group"> from the very first group
  return html.replace(/^<\/tbody><tbody class="date-group">\n/, '');
}

// ─── Full HTML document ───────────────────────────────────────────────────────

function buildHtml(opts: {
  patientName: string | null;
  generatedDate: string;
  fromDate: string;
  toDate: string;
  activeMeds: Medication[];
  entries: Entry[];
  doses: DoseWithMed[];
  days: number;
}): string {
  const { patientName, generatedDate, fromDate, toDate, activeMeds, entries, doses, days } = opts;

  const rows: TimelineRow[] = [
    ...entries.map(e => ({ kind: 'pain' as const, entry: e })),
    ...doses.map(d => ({ kind: 'dose' as const, dose: d })),
  ];
  rows.sort((a, b) => {
    const da = a.kind === 'pain' ? a.entry.entry_date : a.dose.taken_at.slice(0, 10);
    const db = b.kind === 'pain' ? b.entry.entry_date : b.dose.taken_at.slice(0, 10);
    if (da !== db) return db.localeCompare(da);
    const ta = a.kind === 'pain' ? a.entry.created_at : a.dose.taken_at;
    const tb = b.kind === 'pain' ? b.entry.created_at : b.dose.taken_at;
    return tb.localeCompare(ta);
  });

  const chartSvg   = buildChartSvg(entries, days, fromDate);
  const medChips   = buildMedChips(activeMeds);
  const tableRows  = buildTableRows(rows);
  const footerPt   = patientName ? escHtml(patientName) : 'Patient';
  const footerDate = escHtml(generatedDate);

  const paginatorScript = '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Pain &amp; Medication Report</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page { size: letter portrait; margin: 0.5in; }

body {
  font-family: 'Source Sans 3', Arial, Helvetica, sans-serif;
  font-size: 9pt;
  color: #1C2523;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Report header ── */
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12pt;
  padding-bottom: 8pt;
  border-bottom: 1.5px solid #CFDED8;
}
.report-title {
  font-family: 'Lora', Georgia, serif;
  font-size: 18pt;
  font-weight: 600;
  color: #1C2523;
  line-height: 1.15;
  margin-bottom: 2pt;
}
.report-patient {
  font-size: 11pt;
  font-weight: 600;
  color: #1C2523;
  margin-bottom: 2pt;
}
.report-period { font-size: 8.5pt; color: #3A4A44; }
.report-brand  { font-family: 'Lora', Georgia, serif; font-size: 11pt; font-weight: 600; color: #2E7D5E; }
.report-brand-sub { font-size: 8pt; color: #3A4A44; margin-top: 1pt; }
.report-generated { font-size: 8pt; color: #6B7C73; margin-top: 5pt; }

/* ── Section labels ── */
.section-label {
  font-size: 7.5pt;
  font-weight: 700;
  color: #3A4A44;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 5pt;
}

/* ── Medication chips — individual cards, no outer container background ── */
.med-chips { display: flex; flex-wrap: wrap; gap: 6pt; }
.med-chip {
  display: inline-flex;
  flex-direction: column;
  border: 1px solid #CFDED8;
  border-radius: 6pt;
  padding: 4pt 8pt;
  background: #F5FAF6;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.med-chip-name { font-weight: 700; font-size: 9pt; color: #2E7D5E; }
.med-chip-sub  { font-size: 8pt; color: #3A4A44; margin-top: 1pt; }

/* ── Timeline table ── */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  table-layout: fixed;
}

thead th {
  background: transparent;
  color: #1C2523;
  padding: 5pt 5pt;
  text-align: left;
  font-weight: 700;
  font-size: 7.5pt;
  letter-spacing: 0.3px;
  border-bottom: 1.5px solid #1C2523;
}

/* Column widths */
col.c-dt       { width: 14%; }
col.c-level    { width: 8%;  }
col.c-region   { width: 13%; }
col.c-quality  { width: 10%; }
col.c-triggers { width: 16%; }
col.c-mood     { width: 9%;  }
col.c-sleep    { width: 9%;  }
col.c-notes    { width: 21%; }

/* Each date group is its own tbody — keeps the group together by default,
   allows it to break to next page if the whole group is too tall. */
tbody.date-group { break-inside: avoid; page-break-inside: avoid; }

tbody tr { page-break-inside: avoid; break-inside: avoid; }

/* Date separator row: top border + date label centered on it */
.date-sep-row td {
  padding: 0 6pt;
  border-top: 1.5px solid #8a9c95;
  background: transparent;
  position: relative;
  height: 0;
  line-height: 0;
  overflow: visible;
}
.date-sep-label {
  position: absolute;
  top: -0.6em;
  left: 5pt;
  font-size: 7.5pt;
  font-weight: 700;
  color: #1C2523;
  background: transparent;
  padding: 0;
  white-space: nowrap;
  line-height: 1;
  text-shadow: -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff,
               -2px 0 0 #fff, 2px 0 0 #fff, 0 -2px 0 #fff, 0 2px 0 #fff;
}
/* Extra breathing room on the rows flanking each date separator */
tbody.date-group tr:last-child td { padding-bottom: 7pt; }
.date-sep-row + tr td { padding-top: 7pt; }

.pain-row {
  background: #F6EAE8;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.pain-row td { border-bottom: 1px solid #EDD8D6; }

.dose-row { background: #ffffff; font-style: italic; color: #4A5C55; }
.dose-row td { border-bottom: 1px solid #D0DFDA; }

td { padding: 4pt 5pt; vertical-align: top; overflow-wrap: break-word; }

.time-label     { font-size: 7.5pt; color: #5A3A36; }
.dose-row .time-label { color: #4A5C55; }

/* ── Footer ── */
.footer {
  font-size: 7pt;
  color: #6B7C73;
  display: flex;
  justify-content: space-between;
  padding-top: 3pt;
  margin-top: 10pt;
  border-top: 1px solid #CFDED8;
}

@media print {
  .footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: #ffffff;
    padding: 3pt 0;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { padding-bottom: 18pt; }
}
</style>
</head>
<body>

<!-- Report header: left = report info, right = branding -->
<div class="report-header">
  <div>
    <div class="report-title">Pain &amp; Medication Report</div>
    ${patientName ? `<div class="report-patient">${escHtml(patientName)}</div>` : ''}
    <div class="report-period">${escHtml(fmtDateRange(fromDate, toDate))}</div>
  </div>
  <div style="text-align:right;padding-left:20pt;flex-shrink:0;">
    <div class="report-brand">Lilypad</div>
    <div class="report-brand-sub">ThePainNP</div>
    <div class="report-generated">Generated ${escHtml(generatedDate)}</div>
  </div>
</div>

<!-- Active medications: individual chips, no outer card background -->
<div style="margin-bottom:10pt;padding-bottom:8pt;border-bottom:1px solid #CFDED8;">
  <div class="section-label">Active Medications</div>
  <div class="med-chips">${medChips}</div>
</div>

<!-- Pain trend chart -->
<div style="margin-bottom:10pt;padding-bottom:8pt;border-bottom:1px solid #CFDED8;">
  <div class="section-label">Pain Trend - Daily Peak</div>
  <div style="overflow:hidden;">${chartSvg}</div>
</div>

<!-- Timeline -->
<div class="section-label">Pain &amp; Medication Timeline</div>
<table id="timeline-table">
  <colgroup>
    <col class="c-dt"/>
    <col class="c-level"/>
    <col class="c-region"/>
    <col class="c-quality"/>
    <col class="c-triggers"/>
    <col class="c-mood"/>
    <col class="c-sleep"/>
    <col class="c-notes"/>
  </colgroup>
  <thead>
    <tr>
      <th>Date &amp; Time</th>
      <th>Level</th>
      <th>Region</th>
      <th>Quality</th>
      <th>Triggers</th>
      <th>Mood</th>
      <th>Sleep</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
${rows.length === 0
  ? '<tr><td colspan="8" style="padding:8pt;color:#6B7C73;font-style:italic;">No entries in this period.</td></tr></tbody>'
  : tableRows + '</tbody>'}
</table>

<!-- Footer -->
<div class="footer">
  <span>Lilypad is a personal logging tool, not a medical record. For clinical use by ${footerPt}'s provider only.</span>
  <span>${footerPt} &middot; ${footerDate}</span>
</div>

${paginatorScript}
</body>
</html>`;
}

// ─── Public export function ───────────────────────────────────────────────────

export async function exportPdf(days: number): Promise<void> {
  const today    = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const fromISO  = fromDate + 'T00:00:00.000Z';
  const toISO    = today    + 'T23:59:59.999Z';

  const [entries, doses, activeMeds, settings] = await Promise.all([
    getEntriesInRange(fromDate, today),
    getDosesInRangeWithMedication(fromISO, toISO),
    getMedications(false),
    getSettings(),
  ]);

  const html = buildHtml({
    patientName: settings.patient_name,
    generatedDate: fmtLongDate(today),
    fromDate,
    toDate: today,
    activeMeds,
    entries,
    doses: doses as DoseWithMed[],
    days,
  });

  const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false });

  const fileName  = buildFileName(settings.patient_name);
  const targetUri = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory!) + fileName;
  await FileSystem.moveAsync({ from: tempUri, to: targetUri });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(targetUri, {
    mimeType: 'application/pdf',
    dialogTitle: fileName,
    UTI: 'com.adobe.pdf',
  });
}
