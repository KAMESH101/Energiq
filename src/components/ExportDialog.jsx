import { useState } from 'react';
import { ZONES } from '../lib/campus.js';
import { lsGet, lsSet } from '../lib/format.js';
import { REPORT_FORMATS, REPORT_PERIODS, REPORT_SECTIONS, DEFAULT_REPORT_OPTS, buildReport } from '../lib/report.js';
import { usePal } from '../lib/theme.js';
import { Icon, Seg } from './ui.jsx';

const loadOpts = () => {
  try {
    const o = JSON.parse(lsGet('energiq-report-opts') || 'null');
    return o ? { ...DEFAULT_REPORT_OPTS, ...o, sections: { ...DEFAULT_REPORT_OPTS.sections, ...o.sections } } : DEFAULT_REPORT_OPTS;
  } catch { return DEFAULT_REPORT_OPTS; }
};

function Chip({ on, onClick, children }) {
  const pal = usePal();
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] border transition-colors"
      style={on ? { borderColor: pal.cyan, color: 'var(--text-primary)', background: `color-mix(in srgb, ${pal.cyan} 12%, transparent)` } : { borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
      <Icon name={on ? 'Check' : 'Plus'} size={13} style={{ color: on ? pal.cyan : undefined }} />{children}
    </button>
  );
}

const Label = ({ children }) => <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-2">{children}</div>;

/** Report options: format, period, sections, zones, alert scope. `onExport(opts)` does the download. */
export default function ExportDialog({ model, alerts, recs, applied, onExport }) {
  const pal = usePal();
  const [o, setO] = useState(loadOpts);
  const set = patch => setO(p => { const n = { ...p, ...patch }; lsSet('energiq-report-opts', JSON.stringify(n)); return n; });
  const toggleSection = id => set({ sections: { ...o.sections, [id]: !o.sections[id] } });
  const toggleZone = id => set({ zones: o.zones.includes(id) ? o.zones.filter(z => z !== id) : [...o.zones, id] });

  const anySection = REPORT_SECTIONS.some(s => o.sections[s.id]);
  const ok = anySection && o.zones.length > 0;
  const preview = ok ? buildReport(model, alerts, recs, applied, o) : null;
  const kb = preview ? new Blob([preview.text]).size / 1024 : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label>Format</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REPORT_FORMATS.map(f => {
            const on = o.format === f.id;
            return (
              <button key={f.id} onClick={() => set({ format: f.id })} className="rounded-lg border p-3 text-left transition-colors"
                style={on ? { borderColor: pal.cyan, background: `color-mix(in srgb, ${pal.cyan} 10%, transparent)` } : { borderColor: 'var(--border-subtle)' }}>
                <Icon name={f.icon} size={18} style={{ color: on ? pal.cyan : 'var(--text-tertiary)' }} />
                <div className="text-sm font-semibold mt-1.5">{f.label}</div>
                <div className="text-[11px] text-ink-3">{f.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Period</Label>
        <Seg id="report-period" value={o.period} onChange={v => set({ period: v })} options={REPORT_PERIODS.map(p => ({ value: p.id, label: p.label }))} />
      </div>

      <div>
        <Label>Include</Label>
        <div className="flex flex-wrap gap-2">
          {REPORT_SECTIONS.map(s => <Chip key={s.id} on={o.sections[s.id]} onClick={() => toggleSection(s.id)}>{s.label}</Chip>)}
        </div>
        {o.sections.alerts && (
          <div className="flex items-center gap-3 mt-3 text-sm text-ink-2">
            Alerts:
            <Seg id="report-alerts" value={o.alertScope} onChange={v => set({ alertScope: v })} options={[{ value: 'active', label: 'Active only' }, { value: 'all', label: 'All in period' }]} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Zones</Label>
          <button className="text-xs text-ink-3 hover:text-ink-1 mb-2" onClick={() => set({ zones: o.zones.length === ZONES.length ? [] : ZONES.map(z => z.id) })}>
            {o.zones.length === ZONES.length ? 'Clear' : 'Select all'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ZONES.map(z => <Chip key={z.id} on={o.zones.includes(z.id)} onClick={() => toggleZone(z.id)}>{z.short}</Chip>)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line-subtle">
        <div className="min-w-0 flex-1 text-xs text-ink-3">
          {ok ? <>
            <div className="mono text-ink-2 truncate">{o.format === 'pdf' ? 'Print dialog → Save as PDF' : preview.name}</div>
            <div>{kb < 1 ? '<1' : Math.round(kb)} KB{o.sections.alerts ? ` · ${preview.rows.alerts} alerts` : ''}{o.sections.intervals ? ` · ${preview.rows.intervals} readings` : ''} · live as of now</div>
          </> : <span style={{ color: pal.red }}>{anySection ? 'Pick at least one zone.' : 'Pick at least one section.'}</span>}
        </div>
        <button className="btn btn-primary" style={{ height: 38 }} disabled={!ok} onClick={() => onExport(o)}>
          <Icon name={o.format === 'pdf' ? 'Printer' : 'Download'} size={15} />{o.format === 'pdf' ? 'Print / Save PDF' : 'Download'}
        </button>
      </div>
    </div>
  );
}
