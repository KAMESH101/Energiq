import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, PieChart, Pie, Cell } from 'recharts';
import { fkW, fmtDur, n0, n1, pad, clamp } from '../lib/format.js';
import { ZONES, CATS, PER_DAY, WEEKDAYS, WEEKDAYS_LONG, hhmm, hoursLabel, weekdayIdx } from '../lib/campus.js';
import { L, A } from '../lib/data.js';
import { oneStep } from '../lib/forecast.js';
import { usePal, loadColor, axisTick } from '../lib/theme.js';
import { Icon, CountUp, Badge, Legend2, TipRow, useMountAnim } from '../components/ui.jsx';

function Gauge({ pct, value, max }) {
  const pal = usePal(), p = clamp(pct, 0, 100), color = loadColor(pal, p);
  const R = 100, cx = 140, cy = 140, len = Math.PI * R;
  const pt = q => { const a = Math.PI * (1 - q / 100); return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
  const arc = (a0, a1) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`; };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 280 168" width="100%" style={{ maxWidth: 300 }}>
        <path d={arc(0, 60)} stroke={pal.green} strokeOpacity={0.16} strokeWidth={18} fill="none" />
        <path d={arc(60, 85)} stroke={pal.amber} strokeOpacity={0.16} strokeWidth={18} fill="none" />
        <path d={arc(85, 100)} stroke={pal.red} strokeOpacity={0.16} strokeWidth={18} fill="none" />
        <path d={arc(0, 100)} stroke={color} strokeWidth={18} fill="none" strokeDasharray={len} strokeDashoffset={len * (1 - p / 100)}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out, stroke .6s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
        {[0, 25, 50, 75, 100].map(q => {
          const a = Math.PI * (1 - q / 100);
          return <line key={q} x1={cx + (R - 14) * Math.cos(a)} y1={cy - (R - 14) * Math.sin(a)} x2={cx + (R - 20) * Math.cos(a)} y2={cy - (R - 20) * Math.sin(a)} stroke={pal.t3} strokeWidth={1.5} />;
        })}
        <g style={{ transform: `rotate(${-90 + p * 1.8}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 1s ease-in-out' }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - R + 26} stroke={pal.t1} strokeWidth={3} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={7} fill={pal.t1} /><circle cx={cx} cy={cy} r={3} fill={pal.s1} />
        <text x={cx} y={cy - 38} textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily="JetBrains Mono">{Math.round(pct)}%</text>
        <text x={cx - R} y={cy + 24} textAnchor="middle" fill={pal.t3} fontSize="11" fontFamily="JetBrains Mono">0%</text>
        <text x={cx + R} y={cy + 24} textAnchor="middle" fill={pal.t3} fontSize="11" fontFamily="JetBrains Mono">100%</text>
      </svg>
      <div className="text-center -mt-1">
        <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">Current</div>
        <div className="text-3xl font-bold" style={{ color }}><CountUp value={value} format={fkW} /></div>
        <div className="text-xs text-ink-2 mt-0.5">of {max} kW capacity</div>
      </div>
    </div>
  );
}

function heatColor(r) {
  r = clamp(r, 0, 1.2);
  if (r < 0.5) return `color-mix(in srgb, var(--energy-green) ${Math.round(8 + r / 0.5 * 62)}%, var(--surface-2))`;
  if (r < 0.8) return `color-mix(in srgb, var(--energy-amber) ${Math.round((r - 0.5) / 0.3 * 100)}%, var(--energy-green))`;
  return `color-mix(in srgb, var(--energy-red) ${Math.round(clamp((r - 0.8) / 0.2, 0, 1) * 100)}%, var(--energy-amber))`;
}

export default function Zones({ model, zoneSel, setZoneSel, thresholds }) {
  const pal = usePal(), anim = useMountAnim(1000);
  const z = model.zmap[zoneSel], th = thresholds[zoneSel];
  const [hoverCat, setHoverCat] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);

  const line = useMemo(() => {
    const rows = [];
    for (let s = 0; s < PER_DAY; s++) {
      const k = model.dayStart + s, t = k - model.abs, past = t <= 0;
      rows.push({ x: s, actual: past ? L(z.id, k) : null, pred: past ? oneStep(z.id, k) : z.fc.pred[t - 1], anom: past && A(z.id, k) ? L(z.id, k) : null });
    }
    return rows;
  }, [model.abs, zoneSel]); // eslint-disable-line react-hooks/exhaustive-deps -- interval data changes once per reading

  const liveLine = useMemo(() => {
    const rows = line.slice();
    rows.splice(model.slot + 1, 0, { x: model.liveX, actual: z.cur, pred: null, anom: null, live: true });
    return rows;
  }, [line, model, z]);

  const hourKey = Math.floor(model.abs / 4);
  const heat = useMemo(() => {
    const today = Math.floor(model.abs / PER_DAY), cols = [];
    for (let c = 0; c < 7; c++) {
      const d = today - 6 + c, cells = [];
      for (let h = 0; h < 24; h++) {
        let s = 0, n = 0;
        for (let q = 0; q < 4; q++) { const k = d * PER_DAY + h * 4 + q; if (k <= model.abs) { s += L(z.id, k); n++; } }
        cells.push(n ? s / n : null);
      }
      const wd = weekdayIdx(d);
      cols.push({ d, label: WEEKDAYS[wd], long: WEEKDAYS_LONG[wd], cells });
    }
    return cols;
  }, [hourKey, zoneSel]); // recompute hourly, not every tick

  // Current-hour cell blends the finished intervals of this hour with the live reading.
  const curHour = Math.floor(model.slot / 4), hourStart = model.dayStart + curHour * 4;
  let hs = z.cur; for (let k = hourStart; k < model.abs; k++) hs += L(z.id, k);
  const liveHourAvg = hs / (model.abs - hourStart + 1);

  let slotsAtPeak = 0;
  for (let k = model.dayStart; k <= model.abs; k++) if (L(z.id, k) >= z.peakLoad * th.warn / 100) slotsAtPeak++;
  const donut = CATS.map(c => ({ key: c.key, name: c.label, value: z.catKw[c.key], pct: z.breakdown[c.key] * 100, color: pal[c.color] }));
  const top = donut.slice().sort((a, b) => b.value - a.value)[0];
  const focus = hoverCat != null ? donut[hoverCat] : top;
  const [oh0, oh1] = z.operatingHours;

  const LineTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    return (
      <div className="chart-tip">
        <div className="font-semibold mb-1 mono">{r.live ? <>Now <span style={{ color: pal.cyan }} className="text-[10px] ml-1">LIVE</span></> : <>{hhmm(r.x)} IST</>}</div>
        {r.actual != null && <TipRow color={pal.blue} label="Actual" value={fkW(r.actual)} />}
        {r.pred != null && <TipRow color={pal.purple} label="Predicted" value={fkW(r.pred)} />}
        {r.anom != null && <div className="text-xs mt-1" style={{ color: pal.red }}>● Anomaly: idle equipment detected</div>}
      </div>
    );
  };

  const stats = [
    ['Peak Today', <>{fkW(z.peakToday)} <span className="text-ink-3 text-xs">@ {hhmm(z.peakAt)}</span></>],
    ['Average Today', fkW(z.avgToday)],
    [`Time ≥ ${th.warn}% cap.`, slotsAtPeak ? fmtDur(slotsAtPeak * 15) : '0 min'],
    ['Idle Draw', z.idleMinToday
      ? <span style={{ color: pal.red }}>⚠ {fmtDur(z.idleMinToday)} @ {hhmm(z.idleFirst)}</span>
      : <span style={{ color: pal.green }}>None today</span>],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
        {ZONES.map(zz => {
          const mz = model.zmap[zz.id], on = zz.id === zoneSel;
          return (
            <button key={zz.id} onClick={() => setZoneSel(zz.id)}
              className={`relative flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${on ? 'text-ink-1' : 'text-ink-2 hover:text-ink-1 hover:bg-surface-2'}`}
              style={on ? { background: 'var(--surface-3)' } : undefined}>
              <Icon name={zz.icon} size={15} />{zz.name}
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: mz.idleNow ? pal.red : loadColor(pal, mz.pct) }} />
              {on && <motion.span layoutId="zone-underline" className="absolute left-2 right-2 -bottom-[3px] h-[2px] rounded-full" style={{ background: pal.cyan, boxShadow: `0 0 8px ${pal.cyan}` }} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            </button>
          );
        })}
      </div>

      <motion.div key={zoneSel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="card-title">{z.name} · Live Load</div>
              {z.idleNow ? <Badge tone="red">Idle draw {fmtDur(z.idleRunMin)}</Badge> : <Badge tone={z.open ? 'green' : 'blue'}>{z.open ? 'Operating' : 'Closed'}</Badge>}
            </div>
            <Gauge pct={z.pct} value={z.cur} max={z.peakLoad} />
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              {[['Hours', hoursLabel(z)], ['Area', `${n0(z.sqft)} ft²`], ['Intensity', `${n1(z.cur * 1000 / z.sqft)} W/ft²`]].map(([k, v]) => (
                <div key={k} className="rounded-lg py-2" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-[10px] uppercase tracking-wider text-ink-3">{k}</div><div className="mono text-xs mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="card-title">24h · Actual vs Predicted</div>
              <Legend2 items={[{ label: 'Actual', color: pal.blue }, { label: 'Predicted', color: pal.purple, dash: true }, { label: 'Anomaly', color: pal.red, dot: true }]} />
            </div>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={liveLine} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={pal.grid} vertical={false} />
                  {oh1 - oh0 < 24 && <ReferenceArea x1={oh0 * 4} x2={Math.min(95, oh1 * 4)} fill={pal.t3} fillOpacity={0.07} label={{ value: 'Operating hours', position: 'insideTop', fill: pal.t3, fontSize: 10 }} />}
                  <XAxis dataKey="x" type="number" domain={[0, 95]} ticks={[0, 16, 32, 48, 64, 80]} tickFormatter={hhmm} tick={axisTick(pal)} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick(pal)} axisLine={false} tickLine={false} domain={[0, Math.ceil(z.peakLoad * 1.15 / 10) * 10]} width={44} />
                  <Tooltip content={<LineTip />} cursor={{ stroke: pal.t3, strokeDasharray: '3 3' }} isAnimationActive={false} />
                  <ReferenceLine y={z.peakLoad * th.warn / 100} stroke={pal.amber} strokeDasharray="6 4" />
                  <Line dataKey="pred" stroke={pal.purple} strokeWidth={1.5} strokeDasharray="6 3" dot={false} isAnimationActive={anim} />
                  <Line dataKey="actual" stroke={pal.blue} strokeWidth={2} dot={false} isAnimationActive={anim} activeDot={{ r: 4 }} />
                  <Line dataKey="anom" stroke="none" dot={{ r: 4, fill: pal.red, stroke: pal.red }} isAnimationActive={false} activeDot={{ r: 5, fill: pal.red }} />
                  <ReferenceLine x={model.liveX} stroke={pal.cyan} strokeDasharray="4 3" label={{ value: 'Now', position: 'top', fill: pal.cyan, fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-title mb-2">Category Breakdown</div>
            <div className="relative" style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}
                    animationDuration={700} onMouseEnter={(_, i) => setHoverCat(i)} onMouseLeave={() => setHoverCat(null)}>
                    {donut.map((d, i) => <Cell key={d.key} fill={d.color} fillOpacity={hoverCat == null || hoverCat === i ? 1 : 0.35} style={{ transition: 'fill-opacity .2s', cursor: 'pointer' }} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="mono text-2xl font-bold" style={{ color: focus.color }}>{Math.round(focus.pct)}%</div>
                <div className="text-xs text-ink-2 font-medium">{focus.name}</div>
                <div className="mono text-[11px] text-ink-3">{fkW(focus.value)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {donut.map((d, i) => (
                <div key={d.key} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-default transition-colors"
                  style={{ background: hoverCat === i ? 'var(--surface-3)' : 'var(--surface-2)' }} onMouseEnter={() => setHoverCat(i)} onMouseLeave={() => setHoverCat(null)}>
                  <span className="flex items-center gap-2 text-ink-2"><span className="swatch" style={{ background: d.color }} />{d.name}</span>
                  <span className="mono">{Math.round(d.pct)}% · {fkW(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title mb-3">Today's Stats</div>
            <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-line-subtle">
              {stats.map(([k, v], i) => (
                <div key={k} className={`p-3 ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b' : ''} border-line-subtle`}>
                  <div className="text-[11px] text-ink-3 uppercase tracking-wider">{k}</div>
                  <div className="mono text-sm font-semibold mt-1">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-5 mb-2">
              <div className="card-title" style={{ fontSize: 11 }}>7-Day Hourly Heatmap</div>
              <div className="text-xs mono text-ink-2 min-h-[16px]">
                {hoverCell ? `${hoverCell.day} ${pad(hoverCell.h)}:00 — ${hoverCell.v == null ? 'no data yet' : fkW(hoverCell.v)}` : <span className="text-ink-3">hover a cell</span>}
              </div>
            </div>
            <div className="flex gap-1.5" onMouseLeave={() => setHoverCell(null)}>
              <div className="flex flex-col gap-[2px] pt-[18px] pr-1">
                {Array.from({ length: 24 }, (_, h) => <div key={h} className="mono text-[9px] leading-[9px] h-[9px] text-ink-3 text-right">{h % 6 === 0 ? pad(h) : ''}</div>)}
              </div>
              {heat.map((col, ci) => (
                <div key={col.d} className="flex-1 flex flex-col gap-[2px] min-w-0">
                  <div className="text-[10px] text-ink-3 text-center h-4 mb-[2px]">{col.label}</div>
                  {col.cells.map((v0, h) => { const v = ci === heat.length - 1 && h === curHour ? liveHourAvg : v0; return (
                    <div key={h} className="heat-cell" onMouseEnter={() => setHoverCell({ day: col.long, h, v })}
                      style={{ background: v == null ? 'transparent' : heatColor(v / z.peakLoad), border: v == null ? '1px dashed var(--border-subtle)' : 'none', transition: 'background .8s' }} />
                  ); })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-ink-3">Low
              {[0.1, 0.35, 0.6, 0.75, 0.9, 1].map(r => <span key={r} className="w-3 h-2 rounded-sm" style={{ background: heatColor(r) }} />)}High
            </div>
          </div>
      </motion.div>
    </div>
  );
}
