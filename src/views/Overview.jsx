import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart, Bar, Cell, LabelList } from 'recharts';
import { fkW, fkWh2, fINR, fINR2, fPct, n0, fmtAgo, fmtDur } from '../lib/format.js';
import { ZONES, ZMAP, CATS, CAPACITY, PER_DAY, hhmm, dateOf, clockOf } from '../lib/campus.js';
import { L, TOT, ANY_ANOM } from '../lib/data.js';
import { oneStepTotal } from '../lib/forecast.js';
import { secsUntil } from '../lib/live.js';
import { usePal, sevColor, loadColor, axisTick } from '../lib/theme.js';
import { Icon, CountUp, SevDot, EmptyState, Legend2, TipRow, useMountAnim, stagger, rise } from '../components/ui.jsx';

function KpiCard({ icon, label, children, sub, subColor, accent }) {
  const pal = usePal();
  return (
    <motion.div variants={rise} className="card relative overflow-hidden">
      {accent && <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: accent, opacity: 0.8 }} />}
      <div className="flex items-center gap-2 text-ink-2 text-[13px] font-medium"><Icon name={icon} size={15} style={accent ? { color: accent } : undefined} />{label}</div>
      <div className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.25rem)', lineHeight: 1.15 }}>{children}</div>
      <div className="mt-2 text-xs flex items-center gap-1.5" style={{ color: subColor || pal.t2 }}>{sub}</div>
    </motion.div>
  );
}

export default function Overview({ model, alerts, recs, applied, thresholds, onZone, onGoto }) {
  const pal = usePal(), anim = useMountAnim(1000);
  const [hoverBar, setHoverBar] = useState(null);
  const [openFeed, setOpenFeed] = useState(null);

  const campusThr = ZONES.reduce((s, z) => s + z.peakLoad * thresholds[z.id].warn / 100, 0);
  const appliedRecs = recs.filter(r => applied.includes(r.id));
  const savedRunRate = appliedRecs.reduce((s, r) => s + r.inrDay, 0);
  const savedToday = savedRunRate * model.liveX / PER_DAY;
  const peakIn = secsUntil(model, model.predPeakAt);
  const trendUp = model.trendPct >= 0;
  const feed = alerts.slice(0, 30);

  const chart = useMemo(() => {
    const rows = [];
    for (let s = 0; s < PER_DAY; s++) {
      const k = model.dayStart + s, t = k - model.abs, past = t <= 0;
      rows.push({
        x: s,
        actual: past ? TOT(k) : null,
        pred: t === 0 ? TOT(k) : t > 0 ? model.fcTotal.pred[t - 1] : null,
        band: t === 0 ? [TOT(k), TOT(k)] : t > 0 ? [model.fcTotal.lower[t - 1], model.fcTotal.upper[t - 1]] : null,
        bt: past && t < 0 ? oneStepTotal(k) : null, // back-tested 15-min-ahead prediction, for the tooltip Δ
        anom: past && ANY_ANOM(k) ? TOT(k) : null,
        zones: ZONES.map(z => (past ? L(z.id, k) : model.zmap[z.id].fc.pred[t - 1])),
      });
    }
    return rows;
  }, [model.abs]); // eslint-disable-line react-hooks/exhaustive-deps -- interval data changes once per reading

  // Live point: the actual line reaches the current second and the forecast continues from it.
  const liveChart = useMemo(() => {
    const rows = chart.map(r => (r.x === model.slot ? { ...r, pred: null, band: null } : r));
    rows.splice(model.slot + 1, 0, { x: model.liveX, actual: model.cur, pred: model.cur, band: [model.cur, model.cur], bt: null, anom: null, zones: model.zones.map(z => z.cur), live: true });
    return rows;
  }, [chart, model]);

  const ranking = useMemo(
    () => model.zones.map(z => ({ id: z.id, name: z.short, total: z.cur, ...z.catKw })).sort((a, b) => b.total - a.total),
    [model],
  );

  const OverTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload, isFut = r.actual == null, a = r.actual, p = isFut ? r.pred : r.bt;
    const delta = a != null && p != null && a > 0 ? (p - a) / a * 100 : null;
    return (
      <div className="chart-tip">
        <div className="font-semibold mb-1 mono">{r.live ? <>Now <span style={{ color: pal.cyan }} className="text-[10px] ml-1">LIVE</span></> : <>{hhmm(r.x)} IST</>} {isFut && <span style={{ color: pal.purple }} className="text-[10px] ml-1">FORECAST</span>}</div>
        {a != null && <TipRow color={pal.blue} label="Actual" value={fkW(a)} />}
        {p != null && <TipRow color={pal.purple} label="Predicted" value={fkW(p)} />}
        {delta != null && <TipRow label="Δ error" value={`${delta > 0 ? '+' : ''}${fPct(delta)}`} valueStyle={{ color: Math.abs(delta) < 3 ? pal.green : Math.abs(delta) < 8 ? pal.amber : pal.red }} />}
        {r.anom != null && <div className="row"><span className="k" style={{ color: pal.red }}>● Anomaly detected</span></div>}
        <div className="border-t border-line-subtle mt-1.5 pt-1.5">
          {ZONES.map((z, i) => <TipRow key={z.id} label={z.short} value={fkW(r.zones[i])} valueStyle={{ color: pal.t2 }} />)}
        </div>
      </div>
    );
  };

  const BarTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    return (
      <div className="chart-tip">
        <div className="font-semibold mb-1">{ZMAP[r.id].name}</div>
        {CATS.map(c => <TipRow key={c.key} color={pal[c.color]} label={c.label} value={`${fkW(r[c.key])} · ${Math.round(ZMAP[r.id].breakdown[c.key] * 100)}%`} />)}
        <div className="border-t border-line-subtle mt-1 pt-1"><TipRow label="Total" value={fkW(r.total)} valueStyle={{ fontWeight: 600 }} /></div>
        <div className="text-[10px] text-ink-3 mt-1">Click to open zone monitor</div>
      </div>
    );
  };

  const yMax = m => Math.ceil(Math.max(m, campusThr) * 1.08 / 40) * 40;

  return (
    <div className="flex flex-col gap-5">
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-tour="kpis">
        <KpiCard icon="Activity" label="Total Consumption Today" subColor={trendUp ? pal.red : pal.green}
          sub={<><Icon name={trendUp ? 'TrendingUp' : 'TrendingDown'} size={13} />{trendUp ? '▲' : '▼'} {fPct(Math.abs(model.trendPct))} vs yesterday (same time)</>}>
          <CountUp value={model.kwhToday} format={fkWh2} />
        </KpiCard>
        <KpiCard icon="Gauge" label="Current Load" accent={loadColor(pal, model.pct)}
          sub={<><span className="live-dot" style={{ width: 6, height: 6 }} />{fPct(model.pct)} of {CAPACITY} kW campus capacity</>}>
          <span style={{ color: loadColor(pal, model.pct) }}><CountUp value={model.cur} format={fkW} /></span>
        </KpiCard>
        <KpiCard icon="Sparkles" label="Predicted Peak (6h)" accent={pal.purple} subColor={pal.purple}
          sub={<><Icon name="Clock" size={13} />expected at {hhmm(model.predPeakAt)} IST{peakIn > 0 ? ` · in ${fmtDur(peakIn / 60)}` : ''} · {fPct(model.predPeak / CAPACITY * 100)} cap.</>}>
          <span style={{ color: pal.purple }}><CountUp value={model.predPeak} format={fkW} /></span>
        </KpiCard>
        <KpiCard icon="IndianRupee" label="Cost Saved Today" accent={pal.green} subColor={pal.green}
          sub={appliedRecs.length
            ? <>{appliedRecs.length} of {recs.length} applied · {fINR(savedRunRate)}/day run-rate</>
            : <button className="underline" onClick={() => onGoto('savings')}>Apply a recommendation to start saving →</button>}>
          <span style={{ color: pal.green }}><CountUp value={savedToday} format={fINR2} /></span>
        </KpiCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="card" data-tour="chart">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="card-title">Campus Load Timeline · {dateOf(model.abs).weekday}</div>
            <div className="text-xs text-ink-3 mt-1">Actual consumption vs. forecast (WMA-12 + trend, blended with 6-day seasonal profile) and confidence band</div>
          </div>
          <Legend2 items={[{ label: 'Actual', color: pal.blue }, { label: 'Forecast', color: pal.purple, dash: true }, { label: 'Confidence', color: pal.purple, opacity: 0.3 }, { label: 'Anomaly', color: pal.red, dot: true }, { label: `Threshold ${n0(campusThr)} kW`, color: pal.amber, dash: true }]} />
        </div>
        <div style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={liveChart} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gOvActual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={pal.blue} stopOpacity={0.3} /><stop offset="100%" stopColor={pal.blue} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke={pal.grid} vertical={false} />
              <XAxis dataKey="x" type="number" domain={[0, 95]} ticks={[0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88]} tickFormatter={hhmm} tick={axisTick(pal)} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick(pal)} axisLine={false} tickLine={false} domain={[0, yMax]} tickCount={5} width={62} unit=" kW" />
              <Tooltip content={<OverTip />} cursor={{ stroke: pal.t3, strokeDasharray: '3 3' }} isAnimationActive={false} />
              <Area dataKey="band" stroke="none" fill={pal.purple} fillOpacity={0.1} isAnimationActive={anim} animationDuration={800} activeDot={false} />
              <Area dataKey="actual" stroke={pal.blue} strokeWidth={2} fill="url(#gOvActual)" isAnimationActive={anim} animationDuration={800} animationEasing="ease-out" dot={false} activeDot={{ r: 4, fill: pal.blue, stroke: pal.s1, strokeWidth: 2 }} />
              <Line dataKey="pred" stroke={pal.purple} strokeWidth={2} strokeDasharray="8 4" dot={false} isAnimationActive={anim} animationDuration={800} activeDot={{ r: 4, fill: pal.purple }} />
              <Line dataKey="anom" stroke="none" isAnimationActive={false} dot={{ r: 3.5, fill: pal.red, stroke: pal.red, strokeWidth: 1 }} activeDot={{ r: 5, fill: pal.red }} legendType="none" />
              <ReferenceLine y={campusThr} stroke={pal.amber} strokeDasharray="6 4" label={{ value: 'Peak Threshold', position: 'insideTopLeft', fill: pal.amber, fontSize: 11 }} />
              <ReferenceLine x={model.liveX} stroke={pal.cyan} strokeDasharray="4 3" label={{ value: 'Now', position: 'top', fill: pal.cyan, fontSize: 11, fontWeight: 600 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }} className="card lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="card-title">Zone Consumption Ranking</div>
            <Legend2 items={CATS.map(c => ({ label: c.label, color: pal[c.color] }))} />
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barCategoryGap={10} style={{ cursor: 'pointer' }}
                onMouseMove={s => setHoverBar(s?.isTooltipActive ? s.activeTooltipIndex : null)} onMouseLeave={() => setHoverBar(null)}
                onClick={s => { const id = s?.activePayload?.[0]?.payload.id; if (id) onZone(id); }}>
                <CartesianGrid stroke={pal.grid} horizontal={false} />
                <XAxis type="number" tick={axisTick(pal)} axisLine={false} tickLine={false} unit=" kW" />
                <YAxis type="category" dataKey="name" tick={{ fill: pal.t2, fontSize: 12 }} axisLine={false} tickLine={false} width={96} />
                <Tooltip content={<BarTip />} cursor={{ fill: pal.s2 }} isAnimationActive={false} />
                {CATS.map((c, ci) => (
                  <Bar key={c.key} dataKey={c.key} stackId="a" fill={pal[c.color]} radius={ci === 3 ? [0, 4, 4, 0] : 0} isAnimationActive={anim} animationDuration={600}>
                    {ranking.map((r, i) => <Cell key={r.id} fillOpacity={hoverBar === null || hoverBar === i ? 0.95 : 0.45} />)}
                    {ci === 3 && <LabelList dataKey="total" content={({ x, y, width, height, value }) => (
                      <text x={x + width + 8} y={y + height / 2} dy={4} fill={pal.t1} fontSize={12} fontFamily="JetBrains Mono" fontWeight={600}>{fkW(value)}</text>
                    )} />}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }} className="card lg:col-span-2 flex flex-col" style={{ padding: 0 }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-line-subtle">
            <div className="card-title flex items-center gap-2"><span className="live-dot" style={{ width: 6, height: 6 }} />Live Activity</div>
            <button className="text-xs text-ink-3 hover:text-ink-1 transition-colors" onClick={() => onGoto('alerts')}>View all →</button>
          </div>
          <div className="overflow-y-auto scroll-thin flex-1" style={{ maxHeight: 340 }}>
            {feed.length === 0 ? <EmptyState title="Waiting for data..." sub="Events appear here as the simulation runs." /> : (
              <AnimatePresence initial={false}>
                {feed.map(a => (
                  <motion.div key={a.id} layout initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    className="px-5 py-3 border-b border-line-subtle cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => setOpenFeed(openFeed === a.id ? null : a.id)}>
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5"><SevDot sev={a.sev} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="mono text-xs text-ink-3">{a.live ? clockOf(a.at) : hhmm(a.abs)}</span>
                          <span className="font-medium text-ink-1 truncate">{a.zone}</span>
                          <span className="text-[11px] text-ink-3 whitespace-nowrap">{fmtAgo((model.nowMs - a.at) / 1000)}</span>
                          {a.live && <span className="text-[9px] font-bold px-1 rounded" style={{ color: pal.cyan, background: `color-mix(in srgb, ${pal.cyan} 14%, transparent)` }}>LIVE</span>}
                          {a.status === 'active' && a.sev !== 'info' && <span className="ml-auto text-[10px] font-bold uppercase" style={{ color: sevColor(pal, a.sev) }}>Active</span>}
                        </div>
                        <div className="text-[13px] text-ink-2 mt-0.5">{a.title}</div>
                        <AnimatePresence>
                          {openFeed === a.id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="text-xs text-ink-3 mt-2 leading-relaxed">{a.detail}</div>
                              <div className="text-xs mt-2 flex items-start gap-1.5" style={{ color: pal.blue }}><Icon name="CornerDownRight" size={13} className="mt-0.5 flex-shrink-0" />{a.action}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
