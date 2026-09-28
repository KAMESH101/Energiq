import { fkW, fkWh, fINR, fPct, fmtDur, n1 } from './format.js';
import { ZONES, CAPACITY, RATE, hhmm, dateOf, clockOf, slotStartMs } from './campus.js';
import { L, isIdle } from './data.js';

export const REPORT_FORMATS = [
  { id: 'md', label: 'Markdown', ext: 'md', type: 'text/markdown', icon: 'FileText', hint: 'Readable summary' },
  { id: 'csv', label: 'CSV', ext: 'csv', type: 'text/csv', icon: 'FileSpreadsheet', hint: 'Opens in Excel' },
  { id: 'json', label: 'JSON', ext: 'json', type: 'application/json', icon: 'Braces', hint: 'For integrations' },
  { id: 'pdf', label: 'PDF', ext: 'pdf', type: 'text/html', icon: 'Printer', hint: 'Print / save as PDF' },
];
export const REPORT_PERIODS = [
  { id: 'today', label: 'Today', title: 'Daily', span: null },
  { id: '24h', label: 'Last 24 h', title: '24-Hour', span: 96 },
  { id: '7d', label: 'Last 7 days', title: 'Weekly', span: 672 },
];
export const REPORT_SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'zones', label: 'Zone breakdown' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'recs', label: 'Recommendations' },
  { id: 'forecast', label: 'Forecast (next 24 h)' },
  { id: 'intervals', label: '15-min readings' },
];
export const DEFAULT_REPORT_OPTS = {
  format: 'md', period: 'today', alertScope: 'active', zones: ZONES.map(z => z.id),
  sections: { summary: true, zones: true, alerts: true, recs: true, forecast: false, intervals: false },
};

/** Everything a report needs for the chosen period and zones, measured up to the live second. */
function collect(model, alerts, recs, applied, o) {
  const abs = model.abs, frac = model.frac ?? 0, nowMs = model.nowMs ?? slotStartMs(abs);
  const period = REPORT_PERIODS.find(p => p.id === o.period) || REPORT_PERIODS[0];
  const k0 = period.span ? abs - period.span + 1 : model.dayStart;
  const hours = Math.max((abs - k0 + frac) / 4, 1 / 60);
  const zs = model.zones.filter(z => o.zones.includes(z.id));
  const allZones = zs.length === ZONES.length;

  const zones = zs.map(z => {
    let kwh = 0, peak = 0, peakAt = k0, idleMin = 0;
    for (let k = k0; k < abs; k++) {
      const v = L(z.id, k); kwh += v * 0.25;
      if (v > peak) { peak = v; peakAt = k; }
      if (isIdle(z, k)) idleMin += 15;
    }
    kwh += (L(z.id, abs) + z.cur) / 2 * 0.25 * frac;
    if (z.cur > peak) { peak = z.cur; peakAt = abs; }
    return { id: z.id, name: z.name, kwh, cost: kwh * RATE, avg: kwh / hours, peak, peakAt, idleMin, cur: z.cur, pct: z.pct, capacity: z.peakLoad };
  }).sort((a, b) => b.kwh - a.kwh);
  const kwh = zones.reduce((s, z) => s + z.kwh, 0);
  const cur = zones.reduce((s, z) => s + z.cur, 0);
  const capacity = zones.reduce((s, z) => s + z.capacity, 0);

  let peak = 0, peakAt = k0;
  for (let k = k0; k < abs; k++) { const v = zs.reduce((s, z) => s + L(z.id, k), 0); if (v > peak) { peak = v; peakAt = k; } }
  if (cur > peak) { peak = cur; peakAt = abs; }

  const alertRows = alerts
    .filter(a => a.abs >= k0 && o.zones.includes(a.zoneId) && (o.alertScope === 'all' || (a.status === 'active' && a.sev !== 'info')))
    .map(a => ({ time: `${dateOf(a.abs).iso} ${a.at ? clockOf(a.at) : `${hhmm(a.abs)}:00`}`, severity: a.sev, zone: a.zone, title: a.title, status: a.status, action: a.action, live: !!a.live }));

  const recRows = recs.map(r => ({ title: r.title, impact: r.impact, applied: applied.includes(r.id), inrDay: r.inrDay, inrMonth: r.inrMonth, zones: r.zones }));

  const forecast = [];
  for (let h = 0; h < 24; h++) {
    const row = { time: `${dateOf(abs + 1 + h * 4).wd} ${hhmm(abs + 1 + h * 4)}` };
    let tot = 0;
    zs.forEach(z => { let s = 0; for (let q = 0; q < 4; q++) s += z.fc.pred[h * 4 + q]; row[z.id] = s / 4; tot += s / 4; });
    row.total = tot;
    forecast.push(row);
  }

  const intervals = [];
  for (let k = k0; k <= abs; k++) {
    const row = { time: `${dateOf(k).iso} ${hhmm(k)}` };
    let tot = 0;
    zs.forEach(z => { const v = k === abs ? z.cur : L(z.id, k); row[z.id] = v; tot += v; });
    row.total = tot;
    intervals.push(row);
  }

  return {
    period, k0, hours, nowMs, zs, allZones, zones, kwh, cost: kwh * RATE, cur, capacity, peak, peakAt,
    alerts: alertRows, recs: recRows, forecast, intervals,
    appliedCount: recRows.filter(r => r.applied).length,
    potential: recRows.reduce((s, r) => s + r.inrMonth, 0),
    dt: dateOf(abs),
  };
}

const csvCell = v => { const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csvRows = rows => rows.map(r => r.map(csvCell).join(',')).join('\n');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toMarkdown(model, d, o) {
  const S = o.sections, scope = d.allZones ? 'All zones' : d.zs.map(z => z.name).join(', ');
  const lines = [
    `# EnergiQ ${d.period.title} Energy Report`, '',
    `Date: ${d.dt.long} (${d.dt.weekday})`, 'Campus: VIT Smart Campus', `Report time: ${clockOf(d.nowMs)} IST`,
    `Period: ${d.period.label} (${fmtDur(d.hours * 60)}) · Zones: ${scope}`, '',
  ];
  if (S.summary) {
    lines.push('## Summary', '',
      `Total Consumption: ${fkWh(d.kwh)}${o.period === 'today' && d.allZones ? ` (${model.trendPct >= 0 ? '+' : ''}${fPct(model.trendPct)} vs yesterday)` : ''}`,
      `Current Load: ${fkW(d.cur)} (${fPct(d.cur / d.capacity * 100)} of ${d.capacity} kW capacity)`,
      `Peak Load: ${fkW(d.peak)} at ${d.peakAt === model.abs ? 'now' : `${dateOf(d.peakAt).wd} ${hhmm(d.peakAt)}`} IST`,
      ...(d.allZones ? [`Predicted Peak (next 6h): ${fkW(model.predPeak)} at ${hhmm(model.predPeakAt)} IST`] : []),
      `Estimated Cost: ${fINR(d.cost)}`,
      `Prediction Accuracy (MAPE): ${fPct(model.acc.mape)} · R² ${model.acc.r2.toFixed(2)}`, '');
  }
  if (S.zones) {
    lines.push('## Zone Breakdown', '',
      ...d.zones.map(z => `- ${z.name}: ${fkWh(z.kwh)} (${fPct(d.kwh ? z.kwh / d.kwh * 100 : 0)}) · ${fINR(z.cost)} · now ${fkW(z.cur)} · peak ${fkW(z.peak)} @ ${hhmm(z.peakAt)}${z.idleMin ? ` · idle draw ${fmtDur(z.idleMin)}` : ''}`), '');
  }
  if (S.alerts) {
    lines.push(`## ${o.alertScope === 'all' ? 'Alerts' : 'Active Alerts'}: ${d.alerts.length}`, '',
      ...(d.alerts.length ? d.alerts.slice(0, 50).map(a => `- [${a.severity.toUpperCase()}] ${a.time} ${a.zone} — ${a.title} (${a.status})`) : ['- None']), '');
  }
  if (S.recs) {
    lines.push(`## Recommendations Applied: ${d.appliedCount}/${d.recs.length}`, '',
      ...d.recs.map(r => `- [${r.applied ? 'x' : ' '}] ${r.title} (${r.impact}) — ${fINR(r.inrMonth)}/month · ${r.zones.join(', ')}`), '',
      `Estimated Monthly Savings: ${fINR(d.potential)}`, '');
  }
  if (S.forecast) {
    lines.push('## Forecast · next 24 h (hourly average)', '', '| Time | ' + d.zs.map(z => z.short).join(' | ') + ' | Total |', '|' + ' --- |'.repeat(d.zs.length + 2),
      ...d.forecast.map(r => `| ${r.time} | ${d.zs.map(z => n1(r[z.id])).join(' | ')} | ${n1(r.total)} |`), '');
  }
  if (S.intervals) {
    lines.push('## 15-min Readings (kW)', '', '| Time | ' + d.zs.map(z => z.short).join(' | ') + ' | Total |', '|' + ' --- |'.repeat(d.zs.length + 2),
      ...d.intervals.map(r => `| ${r.time} | ${d.zs.map(z => n1(r[z.id])).join(' | ')} | ${n1(r.total)} |`), '');
  }
  lines.push('---', 'Built for TeachPulse Hackathon 2026 • EnergiQ by Void • VIT Chennai');
  return lines.join('\n');
}

function toCSV(model, d, o) {
  const S = o.sections, blocks = [];
  blocks.push(csvRows([['EnergiQ Energy Report'], ['Date', d.dt.iso], ['Report time (IST)', clockOf(d.nowMs)], ['Period', d.period.label], ['Zones', d.zs.map(z => z.name).join('; ')]]));
  if (S.summary) blocks.push(csvRows([['Summary'], ['Metric', 'Value'], ['Total consumption (kWh)', d.kwh], ['Current load (kW)', d.cur], ['Peak load (kW)', d.peak], ['Peak time', `${dateOf(d.peakAt).iso} ${hhmm(d.peakAt)}`], ['Estimated cost (INR)', d.cost], ['MAPE (%)', model.acc.mape], ['R2', model.acc.r2]]));
  if (S.zones) blocks.push(csvRows([['Zone breakdown'], ['Zone', 'kWh', 'Cost (INR)', 'Current (kW)', 'Average (kW)', 'Peak (kW)', 'Peak time', 'Idle draw (min)'],
    ...d.zones.map(z => [z.name, z.kwh, z.cost, z.cur, z.avg, z.peak, hhmm(z.peakAt), z.idleMin])]));
  if (S.alerts) blocks.push(csvRows([['Alerts'], ['Time', 'Severity', 'Zone', 'Message', 'Status', 'Recommended action'], ...d.alerts.map(a => [a.time, a.severity, a.zone, a.title, a.status, a.action])]));
  if (S.recs) blocks.push(csvRows([['Recommendations'], ['Title', 'Impact', 'Applied', 'INR/day', 'INR/month', 'Zones'], ...d.recs.map(r => [r.title, r.impact, r.applied ? 'yes' : 'no', r.inrDay, r.inrMonth, r.zones.join('; ')])]));
  if (S.forecast) blocks.push(csvRows([['Forecast next 24 h (kW hourly average)'], ['Time', ...d.zs.map(z => z.name), 'Total'], ...d.forecast.map(r => [r.time, ...d.zs.map(z => r[z.id]), r.total])]));
  if (S.intervals) blocks.push(csvRows([['15-min readings (kW)'], ['Time', ...d.zs.map(z => z.name), 'Total'], ...d.intervals.map(r => [r.time, ...d.zs.map(z => r[z.id]), r.total])]));
  return blocks.join('\n\n');
}

function toJSON(model, d, o) {
  const S = o.sections, out = {
    report: 'EnergiQ Energy Report', campus: 'VIT Smart Campus', generatedAt: new Date(d.nowMs).toISOString(),
    period: { id: d.period.id, label: d.period.label, hours: +d.hours.toFixed(2) }, zones: d.zs.map(z => z.id),
  };
  if (S.summary) out.summary = { kwh: d.kwh, currentKw: d.cur, capacityKw: d.capacity, peakKw: d.peak, peakAt: `${dateOf(d.peakAt).iso} ${hhmm(d.peakAt)}`, costInr: d.cost, mape: model.acc.mape, r2: model.acc.r2 };
  if (S.zones) out.zoneBreakdown = d.zones.map(({ capacity, ...z }) => ({ ...z, peakAt: hhmm(z.peakAt), capacityKw: capacity }));
  if (S.alerts) out.alerts = d.alerts;
  if (S.recs) out.recommendations = d.recs;
  if (S.forecast) out.forecast = d.forecast;
  if (S.intervals) out.intervals = d.intervals;
  return JSON.stringify(out, null, 2);
}

function toHTML(model, d, o) {
  const S = o.sections;
  const table = (head, rows) => `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const parts = [`<h1>EnergiQ ${d.period.title} Energy Report</h1>
    <p class="meta">${esc(d.dt.long)} (${d.dt.weekday}) · VIT Smart Campus · generated ${clockOf(d.nowMs)} IST<br>Period: ${esc(d.period.label)} · Zones: ${esc(d.allZones ? 'All zones' : d.zs.map(z => z.name).join(', '))}</p>`];
  if (S.summary) {
    parts.push(`<h2>Summary</h2><div class="kpis">${[
      ['Consumption', fkWh(d.kwh)], ['Current load', fkW(d.cur)], ['Peak', `${fkW(d.peak)} @ ${hhmm(d.peakAt)}`], ['Estimated cost', fINR(d.cost)], ['Forecast MAPE', fPct(model.acc.mape)],
    ].map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`);
  }
  if (S.zones) parts.push('<h2>Zone breakdown</h2>' + table(['Zone', 'Energy', 'Share', 'Cost', 'Now', 'Peak', 'Idle draw'],
    d.zones.map(z => [z.name, fkWh(z.kwh), fPct(d.kwh ? z.kwh / d.kwh * 100 : 0), fINR(z.cost), fkW(z.cur), `${fkW(z.peak)} @ ${hhmm(z.peakAt)}`, z.idleMin ? fmtDur(z.idleMin) : '—'])));
  if (S.alerts) parts.push(`<h2>${o.alertScope === 'all' ? 'Alerts' : 'Active alerts'} (${d.alerts.length})</h2>` + (d.alerts.length
    ? table(['Time', 'Severity', 'Zone', 'Message', 'Status'], d.alerts.slice(0, 100).map(a => [a.time, a.severity, a.zone, a.title, a.status])) : '<p>None.</p>'));
  if (S.recs) parts.push(`<h2>Recommendations (${d.appliedCount}/${d.recs.length} applied)</h2>` + table(['', 'Recommendation', 'Impact', 'Per month', 'Zones'],
    d.recs.map(r => [r.applied ? '✓' : '', r.title, r.impact, fINR(r.inrMonth), r.zones.join(', ')])) + `<p>Estimated monthly savings: <b>${fINR(d.potential)}</b></p>`);
  if (S.forecast) parts.push('<h2>Forecast · next 24 h (kW, hourly average)</h2>' + table(['Time', ...d.zs.map(z => z.short), 'Total'], d.forecast.map(r => [r.time, ...d.zs.map(z => n1(r[z.id])), n1(r.total)])));
  if (S.intervals) parts.push('<h2>15-min readings (kW)</h2>' + table(['Time', ...d.zs.map(z => z.short), 'Total'], d.intervals.map(r => [r.time, ...d.zs.map(z => n1(r[z.id])), n1(r.total)])));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EnergiQ report ${d.dt.iso}</title><style>
    body{font:13px/1.5 Inter,system-ui,sans-serif;color:#0f172a;margin:32px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #06b6d4;padding-bottom:4px}
    .meta{color:#475569;margin:6px 0 0}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #e2e8f0}th{background:#f1f5f9}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.kpis div{border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}.kpis span{display:block;color:#64748b;font-size:11px}.kpis b{font-size:15px}
    footer{margin-top:30px;color:#94a3b8;font-size:11px}@page{margin:14mm}thead{display:table-header-group}tr{break-inside:avoid}
  </style></head><body>${parts.join('\n')}<footer>Built for TeachPulse Hackathon 2026 • EnergiQ by Void • VIT Chennai</footer></body></html>`;
}

/** Builds the report text in the chosen format. With no options it is the daily Markdown summary. */
export function buildReport(model, alerts, recs, applied, opts = {}) {
  const o = { ...DEFAULT_REPORT_OPTS, ...opts, sections: { ...DEFAULT_REPORT_OPTS.sections, ...opts.sections } };
  const d = collect(model, alerts, recs, applied, o);
  const fmt = REPORT_FORMATS.find(f => f.id === o.format) || REPORT_FORMATS[0];
  const text = fmt.id === 'csv' ? toCSV(model, d, o) : fmt.id === 'json' ? toJSON(model, d, o) : fmt.id === 'pdf' ? toHTML(model, d, o) : toMarkdown(model, d, o);
  const name = `energiq-report-${d.dt.iso}${o.period === 'today' ? '' : `-${o.period}`}.${fmt.ext}`;
  return { text, name, type: fmt.type, format: fmt.id, rows: { alerts: d.alerts.length, intervals: d.intervals.length } };
}

export function downloadText(text, name, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the browser print dialog for an HTML report (choose "Save as PDF"), via a hidden iframe. */
export function printHTML(html) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1000); }, 250);
}
