import { fkW, fkWh, fINR, fPct, fmtDur } from './format.js';
import { CAPACITY, hhmm, dateOf } from './campus.js';

export function buildReport(model, alerts, recs, applied) {
  const dt = dateOf(model.abs);
  const zones = model.zones.slice().sort((a, b) => b.kwhToday - a.kwhToday);
  const active = alerts.filter(a => a.status === 'active' && a.sev !== 'info');
  const potential = recs.reduce((s, r) => s + r.inrMonth, 0);
  const lines = [
    '# EnergiQ Daily Energy Report', '',
    `Date: ${dt.long} (${dt.weekday})`, 'Campus: VIT Smart Campus', `Report time: ${hhmm(model.abs)} IST`, '',
    `Total Consumption: ${fkWh(model.kwhToday)} (${model.trendPct >= 0 ? '+' : ''}${fPct(model.trendPct)} vs yesterday)`,
    `Current Load: ${fkW(model.cur)} (${fPct(model.pct)} of ${CAPACITY} kW capacity)`,
    `Peak Load: ${fkW(model.peakToday)} at ${hhmm(model.peakTodayAt)} IST`,
    `Predicted Peak (next 6h): ${fkW(model.predPeak)} at ${hhmm(model.predPeakAt)} IST`,
    `Estimated Cost: ${fINR(model.costToday)}`, '',
    '## Zone Breakdown', '',
    ...zones.map(z => `- ${z.name}: ${fkWh(z.kwhToday)} (${fPct(model.kwhToday ? z.kwhToday / model.kwhToday * 100 : 0)}) · peak ${fkW(z.peakToday)} @ ${hhmm(z.peakAt)}${z.idleMinToday ? ` · idle draw ${fmtDur(z.idleMinToday)}` : ''}`), '',
    `## Active Alerts: ${active.length}`, '',
    ...(active.length ? active.slice(0, 15).map(a => `- [${a.sev.toUpperCase()}] ${hhmm(a.abs)} ${a.zone} — ${a.title}`) : ['- None']), '',
    `## Recommendations Applied: ${recs.filter(r => applied.includes(r.id)).length}/${recs.length}`, '',
    ...recs.map(r => `- [${applied.includes(r.id) ? 'x' : ' '}] ${r.title} (${r.impact}) — ${fINR(r.inrMonth)}/month · ${r.zones.join(', ')}`), '',
    `Estimated Monthly Savings: ${fINR(potential)}`, '',
    `Prediction Accuracy (MAPE): ${fPct(model.acc.mape)} · R² ${model.acc.r2.toFixed(2)}`, '',
    '---', 'Built for TeachPulse Hackathon 2026 • EnergiQ by VoidVault • VIT Chennai',
  ];
  return { text: lines.join('\n'), name: `energiq-report-${dt.iso}.md` };
}

export function downloadText(text, name, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
