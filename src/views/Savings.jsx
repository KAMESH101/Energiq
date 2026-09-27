import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { fkW, fINR, fPct, n0 } from '../lib/format.js';
import { RATE, MONTHS, MONTHS_LONG } from '../lib/campus.js';
import { WEEK_KWH } from '../lib/data.js';
import { usePal, axisTick } from '../lib/theme.js';
import { Icon, CountUp, Seg, Badge, Legend2, TipRow, stagger, rise } from '../components/ui.jsx';

const SEASON = [0.86, 0.9, 1.02, 1.15, 1.22, 1.12, 1.0, 0.98, 1.0, 0.97, 0.9, 0.86]; // HVAC-driven seasonal load factor (Chennai)
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const IMPACT_TONE = { high: 'red', medium: 'amber', low: 'green' };

export default function Savings({ recs, applied, onApply, onUndo }) {
  const pal = usePal();
  const [scope, setScope] = useState('all');
  const potential = recs.reduce((s, r) => s + r.inrMonth, 0);
  const appliedRecs = recs.filter(r => applied.includes(r.id));
  const appliedMonth = appliedRecs.reduce((s, r) => s + r.inrMonth, 0);
  const realised = potential ? appliedMonth / potential * 100 : 0;

  const monthly = useMemo(() => {
    const sav = scope === 'all' ? potential : appliedMonth;
    let cum = 0;
    return MONTHS.map((m, i) => {
      const cur = WEEK_KWH / 7 * DIM[i] * RATE * SEASON[i], s = sav * DIM[i] / 30 * SEASON[i];
      cum += s;
      return { m, current: cur, optimized: cur - s, saving: s, cum };
    });
  }, [scope, potential, appliedMonth]);

  const MonthTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    return (
      <div className="chart-tip">
        <div className="font-semibold mb-1">{MONTHS_LONG[MONTHS.indexOf(r.m)]}</div>
        <TipRow color={pal.red} swatchOpacity={0.5} label="Current" value={fINR(r.current)} />
        <TipRow color={pal.green} label="Optimized" value={fINR(r.optimized)} />
        <TipRow label="Savings" value={fINR(r.saving)} valueStyle={{ color: pal.green }} />
        <TipRow label="Cumulative" value={fINR(r.cum)} valueStyle={{ color: pal.cyan }} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-wrap items-center gap-x-8 gap-y-3" style={{ padding: '18px 24px' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${pal.green} 15%, transparent)`, color: pal.green }}><Icon name="Lightbulb" size={20} /></div>
          <div><div className="text-xs text-ink-2">Potential Monthly Savings</div><div className="text-2xl font-bold" style={{ color: pal.green }}><CountUp value={potential} format={fINR} /></div></div>
        </div>
        <div className="h-10 w-px bg-line-subtle hidden sm:block" />
        <div><div className="text-xs text-ink-2">Applied</div><div className="mono text-xl font-semibold">{appliedRecs.length}</div></div>
        <div><div className="text-xs text-ink-2">Open</div><div className="mono text-xl font-semibold">{recs.length - appliedRecs.length}</div></div>
        <div><div className="text-xs text-ink-2">Locked-in / month</div><div className="mono text-xl font-semibold" style={{ color: pal.green }}><CountUp value={appliedMonth} format={fINR} /></div></div>
        <div className="flex-1" />
        <div className="w-full sm:w-56">
          <div className="flex justify-between text-xs text-ink-3 mb-1"><span>Realised</span><span className="mono">{fPct(realised)}</span></div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
            <motion.div className="h-full rounded-full" style={{ background: pal.green }} initial={{ width: 0 }} animate={{ width: `${realised}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {recs.map(r => {
          const on = applied.includes(r.id);
          const chips = [
            r.kwhDay > 0 ? [`~${n0(r.kwhDay)} kWh`, r.kwhLabel] : [`−${fkW(r.peakCut)}`, 'max demand'],
            r.id === 'peak-stagger' ? [fINR(r.inrMonth), 'per month'] : [fINR(r.inrDay), 'per day'],
          ];
          return (
            <motion.div key={r.id} variants={rise} className="card flex flex-col" style={on ? { borderColor: pal.green, boxShadow: 'var(--glow-green)' } : undefined}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-2)', color: on ? pal.green : pal.blue }}><Icon name={r.icon} size={18} /></div>
                <div className="text-sm font-semibold text-ink-2 flex-1">{r.category}</div>
                <Badge tone={IMPACT_TONE[r.impact]}>{r.impact}</Badge>
              </div>
              <div className="text-lg font-semibold mt-4">{r.title}</div>
              <p className="text-sm text-ink-2 mt-2 leading-relaxed flex-1">{r.desc}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {chips.map(([v, l], i) => (
                  <div key={i} className="rounded-lg px-3 py-2.5 transition-colors"
                    style={{ background: on ? `color-mix(in srgb, ${pal.green} 12%, transparent)` : 'var(--surface-2)', border: `1px solid ${on ? `color-mix(in srgb, ${pal.green} 35%, transparent)` : 'var(--border-subtle)'}` }}>
                    <div className="mono font-semibold" style={{ color: on ? pal.green : pal.t1 }}>{v}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: on ? pal.green : pal.t3 }}>{on ? 'Saving!' : l}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-ink-3 mt-3">Affected: <span className="text-ink-2">{r.zones.join(', ')}</span></div>
              <div className="flex items-center gap-2 mt-4">
                <button className={`btn flex-1 ${on ? 'btn-success' : 'btn-primary'}`} style={{ height: 38 }} onClick={() => !on && onApply(r)}>
                  {on ? <><Icon name="Check" size={15} />Applied</> : <>Apply Recommendation <Icon name="Check" size={15} /></>}
                </button>
                {on && <button className="btn" style={{ height: 38 }} onClick={() => onUndo(r)} title="Revert this recommendation"><Icon name="RotateCcw" size={14} />Undo</button>}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><div className="card-title">Monthly Cost Projection · 2026</div><div className="text-xs text-ink-3 mt-1">Seasonal HVAC load factored in (Apr–Jun cooling peak)</div></div>
          <Seg id="proj" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All recommendations' }, { value: 'applied', label: 'Applied only' }]} />
        </div>
        <div className="mb-3"><Legend2 items={[{ label: 'Current cost', color: pal.red, opacity: 0.45 }, { label: 'Optimized cost', color: pal.green }, { label: 'Cumulative savings', color: pal.cyan, dash: true }]} /></div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthly} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={pal.grid} vertical={false} />
              <XAxis dataKey="m" tick={axisTick(pal)} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={axisTick(pal)} axisLine={false} tickLine={false} width={56} tickFormatter={v => `₹${n0(v / 1000)}k`} />
              <YAxis yAxisId="r" orientation="right" tick={axisTick(pal)} axisLine={false} tickLine={false} width={56} tickFormatter={v => `₹${n0(v / 1000)}k`} />
              <Tooltip isAnimationActive={false} cursor={{ fill: pal.s2 }} content={<MonthTip />} />
              <Bar yAxisId="l" dataKey="current" fill={pal.red} fillOpacity={0.4} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar yAxisId="l" dataKey="optimized" fill={pal.green} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Line yAxisId="r" dataKey="cum" stroke={pal.cyan} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: pal.cyan }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
