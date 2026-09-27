import { Fragment, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts';
import { fkW, n1 } from '../lib/format.js';
import { ZONES, ZMAP, hhmm, dateOf } from '../lib/campus.js';
import { L } from '../lib/data.js';
import { countTriggers } from '../lib/alerts.js';
import { usePal, sevColor } from '../lib/theme.js';
import { Icon, Seg, SevDot, Toggle, EmptyState } from '../components/ui.jsx';

const SEV_RANK = { critical: 3, warning: 2, info: 1 };

function Sparkline({ alert, abs }) {
  const pal = usePal(), c = sevColor(pal, alert.sev);
  const data = [];
  for (let k = alert.abs - 8; k <= Math.min(alert.abs + 8, abs); k++) data.push({ k, v: L(alert.zoneId, k) });
  return (
    <div style={{ height: 70, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
          <XAxis dataKey="k" type="number" domain={['dataMin', 'dataMax']} hide />
          <YAxis hide domain={[0, 'dataMax']} />
          <ReferenceLine x={alert.abs} stroke={c} strokeDasharray="3 3" />
          <Line dataKey="v" stroke={c} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Tooltip isAnimationActive={false} content={({ active, payload }) => (active && payload?.length
            ? <div className="chart-tip" style={{ minWidth: 0 }}><span className="mono">{hhmm(payload[0].payload.k)} · {fkW(payload[0].payload.v)}</span></div>
            : null)} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RuleSlider({ label, value, onChange, disabled, color, min = 50, max = 100 }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-36 text-sm text-ink-2 flex-shrink-0">{label}</div>
      <input type="range" className="slider flex-1" min={min} max={max} value={value} disabled={disabled} onChange={e => onChange(+e.target.value)}
        style={{ '--fill': color, '--p': `${(value - min) / (max - min) * 100}%` }} />
      <div className="mono text-sm w-12 text-right font-semibold" style={{ color: disabled ? 'var(--text-tertiary)' : color }}>{value}%</div>
    </div>
  );
}

function CustomRules({ rz, customRules, setCustomRules, toast }) {
  const [form, setForm] = useState(null);
  const save = () => {
    const kw = +form.kw;
    if (!(kw > 0)) { toast('Enter a kW limit above 0', 'red'); return; }
    setCustomRules(cr => [...cr, { id: `r${Date.now()}`, zoneId: form.zoneId, kw, severity: form.severity }]);
    setForm(null);
    toast(`Rule added — alert when ${ZMAP[form.zoneId].name} exceeds ${kw} kW`);
  };
  return (
    <div className="lg:col-span-2 flex flex-col gap-3">
      <div className="text-xs text-ink-3 uppercase tracking-wider">Custom rules</div>
      {customRules.length === 0 && !form && <div className="text-sm text-ink-3">No custom rules yet.</div>}
      {customRules.map(r => (
        <div key={r.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--surface-2)' }}>
          <SevDot sev={r.severity} /><span className="flex-1">{ZMAP[r.zoneId].name} load &gt; <span className="mono">{r.kw} kW</span></span>
          <button className="text-ink-3 hover:text-ink-1" onClick={() => { setCustomRules(cr => cr.filter(x => x.id !== r.id)); toast('Custom rule removed', 'blue'); }} aria-label="Delete rule"><Icon name="Trash2" size={14} /></button>
        </div>
      ))}
      {form ? (
        <div className="rounded-lg border border-line p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <select className="field flex-1" value={form.zoneId} onChange={e => setForm({ ...form, zoneId: e.target.value })}>{ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
            <select className="field" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              <option value="warning">Warning</option><option value="critical">Critical</option><option value="info">Info</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-ink-2">Load &gt;</span>
            <input className="field w-24 mono" type="number" min="1" max="200" value={form.kw} onChange={e => setForm({ ...form, kw: e.target.value })} />
            <span className="text-sm text-ink-2">kW</span>
            <div className="flex-1" />
            <button className="btn" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      ) : (
        <button className="btn self-start" onClick={() => setForm({ zoneId: rz, kw: Math.round(ZMAP[rz].peakLoad * 0.7), severity: 'warning' })}><Icon name="Plus" size={14} />Add Custom Rule</button>
      )}
    </div>
  );
}

export default function Alerts({ alerts, abs, onAck, thresholds, setThresholds, customRules, setCustomRules, toast }) {
  const pal = usePal();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'abs', dir: -1 });
  const [open, setOpen] = useState(null);
  const [rz, setRz] = useState('admin');

  const counts = { all: alerts.length, critical: 0, warning: 0, info: 0 };
  alerts.forEach(a => { counts[a.sev]++; });
  const activeCount = alerts.filter(a => a.status === 'active' && a.sev !== 'info').length;

  const rows = useMemo(() => {
    const f = alerts.filter(a => filter === 'all' || a.sev === filter);
    const val = a => (sort.key === 'sev' ? SEV_RANK[a.sev] : sort.key === 'zone' ? a.zone : sort.key === 'title' ? a.title : sort.key === 'status' ? a.status : a.abs * 1000 + a.id);
    return f.slice().sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; }).slice(0, 100);
  }, [alerts, filter, sort]);

  const th = thresholds[rz];
  const trig = useMemo(() => countTriggers(ZMAP[rz], th), [rz, th]);
  const setTh = patch => setThresholds(t => ({ ...t, [rz]: { ...t[rz], ...patch } }));

  const hdr = (key, label, cls = '') => (
    <th className={`text-left font-semibold text-[11px] uppercase tracking-wider text-ink-3 px-4 py-3 cursor-pointer select-none hover:text-ink-1 transition-colors ${cls}`}
      onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))}>
      <span className="inline-flex items-center gap-1">{label}{sort.key === key && <Icon name={sort.dir < 0 ? 'ChevronDown' : 'ChevronUp'} size={12} />}</span>
    </th>
  );
  const statusStyle = s => (s === 'active' ? { color: pal.red, bg: `color-mix(in srgb, ${pal.red} 14%, transparent)` }
    : s === 'acknowledged' ? { color: pal.blue, bg: `color-mix(in srgb, ${pal.blue} 14%, transparent)` }
      : { color: pal.t3, bg: 'var(--surface-2)' });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seg id="alert-filter" value={filter} onChange={setFilter} options={[
          { value: 'all', label: <>All <span className="mono text-ink-3">({counts.all})</span></> },
          { value: 'critical', label: <><SevDot sev="critical" size={7} />Critical <span className="mono text-ink-3">({counts.critical})</span></> },
          { value: 'warning', label: <><SevDot sev="warning" size={7} />Warning <span className="mono text-ink-3">({counts.warning})</span></> },
          { value: 'info', label: <><SevDot sev="info" size={7} />Info <span className="mono text-ink-3">({counts.info})</span></> },
        ]} />
        <div className="text-xs text-ink-3">{activeCount} active · click a row to expand</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="overflow-x-auto scroll-thin" style={{ maxHeight: 520 }}>
          <table className="w-full text-sm" style={{ minWidth: 680 }}>
            <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-1)' }}>
              <tr className="border-b border-line-subtle">{hdr('sev', 'Severity', 'w-24')}{hdr('zone', 'Zone', 'w-40')}{hdr('title', 'Message')}{hdr('abs', 'Time', 'w-32')}{hdr('status', 'Status', 'w-32')}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5}><EmptyState icon="BellOff" title="No alerts in this category" sub="Alerts will appear here as the simulation generates them." /></td></tr>}
              {rows.map((a, i) => {
                const ss = statusStyle(a.status), isOpen = open === a.id;
                return (
                  <Fragment key={a.id}>
                    <motion.tr initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.25 }}
                      className="border-b border-line-subtle cursor-pointer hover:bg-surface-2 transition-colors" style={isOpen ? { background: 'var(--surface-2)' } : undefined}
                      onClick={() => setOpen(isOpen ? null : a.id)}>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><SevDot sev={a.sev} /><span className="text-xs capitalize text-ink-2">{a.sev}</span></span></td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{a.zone}</td>
                      <td className="px-4 py-3 text-ink-2">{a.title}</td>
                      <td className="px-4 py-3 mono text-xs text-ink-3 whitespace-nowrap">{dateOf(a.abs).wd} {hhmm(a.abs)} IST</td>
                      <td className="px-4 py-3"><span className="text-[11px] font-semibold rounded-md px-2 py-1 capitalize" style={{ color: ss.color, background: ss.bg }}>{a.status}</span></td>
                    </motion.tr>
                    {isOpen && (
                      <tr className="border-b border-line-subtle" style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={5} className="px-4 pb-4 pt-1">
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
                            <div className="md:col-span-2">
                              <div className="text-xs text-ink-3 uppercase tracking-wider mb-1">Details</div>
                              <p className="text-sm text-ink-2 leading-relaxed">{a.detail}</p>
                              <div className="text-sm mt-3 flex items-start gap-2" style={{ color: pal.blue }}>
                                <Icon name="Wrench" size={14} className="mt-0.5 flex-shrink-0" /><span><span className="font-semibold">Recommended:</span> {a.action}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="text-xs text-ink-3 uppercase tracking-wider">Zone load ±2h</div>
                              <div className="rounded-lg border border-line-subtle" style={{ background: 'var(--surface-1)' }}><Sparkline alert={a} abs={abs} /></div>
                              <button className={`btn ${a.status === 'active' ? 'btn-primary' : ''}`} disabled={a.status !== 'active'} onClick={e => { e.stopPropagation(); onAck(a); }}>
                                <Icon name="CheckCheck" size={14} />{a.status === 'active' ? 'Acknowledge' : a.status === 'acknowledged' ? 'Acknowledged' : 'Cleared'}
                              </button>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div><div className="card-title">Alert Rules</div><div className="text-xs text-ink-3 mt-1">Changes apply to live alert generation immediately</div></div>
          <select className="field" value={rz} onChange={e => setRz(e.target.value)}>{ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="flex-1"><RuleSlider label="Warning threshold" value={th.warn} disabled={!th.warnOn} color={pal.amber} onChange={v => setTh({ warn: Math.min(v, th.crit - 1) })} /></div>
              <Toggle on={th.warnOn} onChange={v => setTh({ warnOn: v })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1"><RuleSlider label="Critical threshold" value={th.crit} disabled={!th.critOn} color={pal.red} min={60} onChange={v => setTh({ crit: Math.max(v, th.warn + 1) })} /></div>
              <Toggle on={th.critOn} onChange={v => setTh({ critOn: v })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-sm text-ink-2">Idle draw detection <span className="text-ink-3 text-xs">(off-hours load &gt; 60% of base · {fkW(ZMAP[rz].baseLoad * 0.6)})</span></div>
              <Toggle on={th.idleOn} disabled={rz === 'server'} onChange={v => setTh({ idleOn: v })} />
            </div>
            <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-3" style={{ background: 'var(--surface-2)' }}>
              <Icon name="History" size={16} className="text-ink-3" />
              <span>Would have triggered <span className="mono font-bold" style={{ color: pal.cyan }}>{trig.total}</span> times this week · <span className="mono font-bold" style={{ color: pal.cyan }}>{n1(trig.hours)} h</span> in alert</span>
              <span className="text-xs text-ink-3 ml-auto hidden sm:inline">{trig.warn} warning · {trig.crit} critical · {trig.idle} idle</span>
            </div>
          </div>
          <CustomRules rz={rz} customRules={customRules} setCustomRules={setCustomRules} toast={toast} />
        </div>
      </div>
    </div>
  );
}
