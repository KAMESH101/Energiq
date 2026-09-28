import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ScatterChart, Scatter, Cell } from 'recharts';
import { fkW, fPct, fmtDur, fmtCountdown, n0, n1 } from '../lib/format.js';
import { ZONES, ZMAP, hhmm, slotOf, dateOf } from '../lib/campus.js';
import { L, TOT } from '../lib/data.js';
import { upcomingPeaks } from '../lib/alerts.js';
import { secsUntil } from '../lib/live.js';
import { usePal, sevColor, axisTick } from '../lib/theme.js';
import { Icon, CountUp, EmptyState, Legend2, TipRow, useMountAnim, stagger, rise } from '../components/ui.jsx';

export default function Forecast({ model, thresholds, handled, onHandle }) {
  const pal = usePal(), anim = useMountAnim(1000);
  const [scope, setScope] = useState('campus');
  const [zoom, setZoom] = useState(null);
  const [sel, setSel] = useState(null);
  const dragging = useRef(false);

  const thr = scope === 'campus'
    ? ZONES.reduce((s, z) => s + z.peakLoad * thresholds[z.id].warn / 100, 0)
    : ZMAP[scope].peakLoad * thresholds[scope].warn / 100;

  // x = intervals relative to now: −96 (24 h ago) … +96 (24 h ahead)
  const data = useMemo(() => {
    const rows = [], fc = scope === 'campus' ? model.fcTotal : model.zmap[scope].fc;
    const get = k => (scope === 'campus' ? TOT(k) : L(scope, k));
    for (let x = -96; x <= 96; x++) {
      const k = model.abs + x;
      rows.push({
        x,
        actual: x <= 0 ? get(k) : null,
        pred: x === 0 ? get(k) : x > 0 ? fc.pred[x - 1] : null,
        band: x === 0 ? [get(k), get(k)] : x > 0 ? [fc.lower[x - 1], fc.upper[x - 1]] : null,
      });
    }
    return rows;
  }, [model.abs, scope]); // eslint-disable-line react-hooks/exhaustive-deps -- interval data changes once per reading

  // Live point at x = fraction of the current interval elapsed; the forecast continues from it.
  const liveData = useMemo(() => {
    const v = scope === 'campus' ? model.cur : model.zmap[scope].cur;
    const rows = data.map(r => (r.x === 0 ? { ...r, pred: null, band: null } : r));
    rows.splice(97, 0, { x: model.frac, actual: v, pred: v, band: [v, v], live: true });
    return rows;
  }, [data, model, scope]);

  const redZones = useMemo(() => {
    const out = []; let st = null;
    liveData.forEach(r => {
      const over = r.x >= 0 && r.pred != null && r.pred > thr;
      if (over && st === null) st = r.x;
      if (!over && st !== null) { out.push([st, r.x - 1]); st = null; }
    });
    if (st !== null) out.push([st, 96]);
    return out;
  }, [liveData, thr]);

  const [x0, x1] = zoom || [-96, 96];
  const shown = zoom ? liveData.filter(r => r.x >= x0 && r.x <= x1) : liveData;
  const ticks = [];
  for (let x = x0; x <= x1; x++) if (slotOf(model.abs + x) % (x1 - x0 > 60 ? 16 : 4) === 0) ticks.push(x);

  const acc = model.acc;
  const scatter = acc.last.map(o => ({ p: o.p, a: o.a, err: o.err, t: hhmm(o.k), live: o.live }));
  const lo = Math.floor(Math.min(...scatter.map(s => Math.min(s.p, s.a))) * 0.95);
  const hi = Math.ceil(Math.max(...scatter.map(s => Math.max(s.p, s.a))) * 1.05);
  const peaks = upcomingPeaks(model, thresholds);
  const errColor = e => (e < 3 ? pal.green : e < 8 ? pal.amber : pal.red);

  const FTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload, dt = dateOf(model.abs + r.x);
    return (
      <div className="chart-tip">
        <div className="font-semibold mb-1 mono">{r.live ? <>Now <span style={{ color: pal.cyan }} className="text-[10px]">LIVE</span></> : <>{dt.wd} {hhmm(model.abs + r.x)} <span className="text-ink-3 text-[10px]">{r.x > 0 ? `+${fmtDur(r.x * 15)}` : r.x < 0 ? `−${fmtDur(-r.x * 15)}` : ''}</span></>}</div>
        {r.actual != null && <TipRow color={pal.blue} label="Actual" value={fkW(r.actual)} />}
        {r.x > 0 && !r.live && <>
          <TipRow color={pal.purple} label="Forecast" value={fkW(r.pred)} />
          <TipRow label="Range" value={`${n1(r.band[0])}–${n1(r.band[1])}`} valueStyle={{ color: pal.t2 }} />
          {r.pred > thr && <div className="text-xs mt-1" style={{ color: pal.red }}>▲ Above threshold</div>}
        </>}
      </div>
    );
  };

  const ScatterTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const s = payload[0].payload;
    return (
      <div className="chart-tip">
        <div className="font-semibold mono mb-1">{s.t} IST{s.live && <span style={{ color: pal.cyan }} className="text-[10px] ml-1">LIVE · in progress</span>}</div>
        <TipRow label="Predicted" value={fkW(s.p)} />
        <TipRow label="Actual" value={fkW(s.a)} />
        <TipRow label="Error" value={fPct(s.err)} valueStyle={{ color: errColor(s.err) }} />
      </div>
    );
  };

  // Click-and-drag zoom
  const onDown = e => { if (e?.activeLabel != null) { dragging.current = true; setSel([e.activeLabel, e.activeLabel]); } };
  const onMove = e => { if (dragging.current && e?.activeLabel != null) setSel(s => (s ? [s[0], e.activeLabel] : s)); };
  const onUp = () => {
    if (dragging.current && sel) { const a = Math.floor(Math.min(...sel)), b = Math.ceil(Math.max(...sel)); if (b - a >= 4) setZoom([a, b]); }
    dragging.current = false; setSel(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="card-title">48-Hour Forecast</div>
            <div className="text-xs text-ink-3 mt-1">Past 24h actuals · next 24h forecast (WMA-12 + trend, blended with 6-day seasonal profile). Drag to zoom, double-click to reset.</div>
          </div>
          <div className="flex items-center gap-2">
            {zoom && <button className="btn" onClick={() => setZoom(null)}><Icon name="ZoomOut" size={14} />Reset zoom</button>}
            <select className="field" value={scope} onChange={e => { setScope(e.target.value); setZoom(null); }}>
              <option value="campus">Campus total</option>
              {ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3"><Legend2 items={[{ label: 'Actual (24h)', color: pal.blue }, { label: 'Forecast (24h)', color: pal.purple, dash: true }, { label: 'Confidence band', color: pal.purple, opacity: 0.3 }, { label: 'Over threshold', color: pal.red, opacity: 0.35 }]} /></div>
        <div style={{ height: 400, userSelect: 'none' }} onDoubleClick={() => setZoom(null)}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={shown} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { dragging.current = false; setSel(null); }}>
              <defs>
                <linearGradient id="gFcActual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={pal.blue} stopOpacity={0.3} /><stop offset="100%" stopColor={pal.blue} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke={pal.grid} vertical={false} />
              {redZones.map(([a, b]) => <ReferenceArea key={a} x1={Math.max(a, x0)} x2={Math.min(b, x1)} fill={pal.red} fillOpacity={0.1} ifOverflow="hidden" />)}
              <XAxis dataKey="x" type="number" domain={[x0, x1]} allowDataOverflow ticks={ticks} tickFormatter={x => hhmm(model.abs + x)} tick={axisTick(pal)} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick(pal)} axisLine={false} tickLine={false} width={62} unit=" kW" domain={[0, m => Math.ceil(Math.max(m, thr) * 1.08 / 40) * 40]} tickCount={5} />
              <Tooltip content={<FTip />} cursor={{ stroke: pal.t2, strokeWidth: 1, strokeDasharray: '3 3' }} isAnimationActive={false} />
              <Area dataKey="band" stroke="none" fill={pal.purple} fillOpacity={0.08} isAnimationActive={anim} activeDot={false} />
              <Area dataKey="actual" stroke={pal.blue} strokeWidth={2} fill="url(#gFcActual)" isAnimationActive={anim} animationDuration={800} dot={false} activeDot={{ r: 4 }} />
              <Line dataKey="pred" stroke={pal.purple} strokeWidth={2} strokeDasharray="8 4" dot={false} isAnimationActive={anim} animationDuration={800} activeDot={{ r: 4, fill: pal.purple }} />
              <ReferenceLine y={thr} stroke={pal.amber} strokeDasharray="6 4" label={{ value: `Threshold ${n0(thr)} kW`, position: 'insideTopLeft', fill: pal.amber, fontSize: 11 }} />
              {x0 <= model.frac && x1 >= model.frac && <ReferenceLine x={model.frac} stroke={pal.cyan} strokeWidth={1.5} label={{ value: 'NOW', position: 'top', fill: pal.cyan, fontSize: 11, fontWeight: 700 }} />}
              {sel && <ReferenceArea x1={Math.min(...sel)} x2={Math.max(...sel)} fill={pal.blue} fillOpacity={0.12} stroke={pal.blue} strokeOpacity={0.4} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
          <div className="card-title">Prediction Accuracy</div>
          <div className="flex flex-wrap items-end gap-6 mt-4">
            <div>
              <div className="kpi-value text-5xl font-bold" style={{ color: acc.mape < 5 ? pal.green : acc.mape < 10 ? pal.amber : pal.red }}><CountUp value={acc.mape} format={fPct} /></div>
              <div className="text-xs text-ink-2 mt-1">Mean Absolute Percentage Error<br /><span className="text-ink-3">15-min-ahead campus forecast · last 20</span></div>
            </div>
            <div className="flex gap-4 pb-1">
              <div><div className="text-[11px] text-ink-3 uppercase tracking-wider">R² (24h)</div><div className="mono text-xl font-semibold">{acc.r2.toFixed(2)}</div></div>
              <div><div className="text-[11px] text-ink-3 uppercase tracking-wider">Within 3%</div><div className="mono text-xl font-semibold">{acc.last.filter(o => o.err < 3).length}/20</div></div>
            </div>
          </div>
          <div style={{ height: 250 }} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 12, left: -6, bottom: 12 }}>
                <CartesianGrid stroke={pal.grid} />
                <XAxis type="number" dataKey="p" name="Predicted" domain={[lo, hi]} tick={axisTick(pal)} axisLine={false} tickLine={false} label={{ value: 'Predicted kW', position: 'insideBottom', offset: -6, fill: pal.t3, fontSize: 11 }} />
                <YAxis type="number" dataKey="a" name="Actual" domain={[lo, hi]} tick={axisTick(pal)} axisLine={false} tickLine={false} width={48} label={{ value: 'Actual kW', angle: -90, position: 'insideLeft', offset: 16, fill: pal.t3, fontSize: 11 }} />
                <ReferenceLine segment={[{ x: lo, y: lo }, { x: hi, y: hi }]} stroke={pal.t3} strokeDasharray="4 4" ifOverflow="hidden" />
                <Tooltip isAnimationActive={false} cursor={{ strokeDasharray: '3 3', stroke: pal.t3 }} content={<ScatterTip />} />
                <Scatter data={scatter} isAnimationActive={anim}>
                  {scatter.map((s, i) => <Cell key={i} fill={s.live ? pal.cyan : errColor(s.err)} fillOpacity={0.85} stroke={s.live ? pal.cyan : 'none'} strokeWidth={s.live ? 6 : 0} strokeOpacity={0.25} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-3 mt-1">
            <span>Last 20 predictions shown · <span style={{ color: pal.cyan }}>●</span> current interval (live) · diagonal = perfect prediction</span>
            <Legend2 items={[{ label: '<3%', color: pal.green, dot: true }, { label: '3–8%', color: pal.amber, dot: true }, { label: '>8%', color: pal.red, dot: true }]} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
          <div className="flex items-center justify-between"><div className="card-title">Upcoming Peak Alerts</div><span className="text-xs text-ink-3">next 6 hours</span></div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-3 mt-4">
            {peaks.length === 0 && <EmptyState icon="CircleCheck" title="No peaks predicted" sub="All zones are forecast to stay below their warning thresholds for the next 6 hours." />}
            {peaks.map(p => {
              const done = handled.includes(p.key), c = sevColor(pal, p.sev);
              return (
                <motion.div key={p.key} variants={rise} className="rounded-xl border p-4 transition-colors"
                  style={{ borderColor: done ? `color-mix(in srgb, ${pal.green} 45%, transparent)` : 'var(--border-subtle)', background: 'var(--surface-2)', opacity: done ? 0.7 : 1 }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }}>
                      <Icon name={p.type === 'idle' ? 'PowerOff' : 'TriangleAlert'} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm"><span className="mono font-semibold">{hhmm(p.at)}</span><span className="text-ink-3">—</span><span className="font-medium">{p.zone.name}</span>
                        {!done && secsUntil(model, p.at) > 0 && <span className="ml-auto mono text-[11px] px-1.5 py-0.5 rounded" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>in {fmtCountdown(secsUntil(model, p.at))}</span>}</div>
                      <div className="text-xs text-ink-2 mt-1">
                        {p.type === 'spike'
                          ? <>Predicted: <span className="mono" style={{ color: c }}>{fkW(p.kw)} ({Math.round(p.pct)}%)</span></>
                          : <>Predicted idle draw after closing · {fmtDur(p.idleMin)} seen this week</>}
                      </div>
                      <div className="text-xs mt-1.5 flex items-start gap-1.5" style={{ color: pal.blue }}><Icon name="CornerDownRight" size={13} className="mt-0.5 flex-shrink-0" />{p.action}</div>
                    </div>
                    <button className={`btn ${done ? 'btn-success' : ''} flex-shrink-0`} style={{ height: 30 }} disabled={done} onClick={() => onHandle(p)}>
                      {done ? <><Icon name="Check" size={14} />Handled</> : 'Apply'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
