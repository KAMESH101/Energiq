import { fkW, fPct, fINR, n1, pad, fmtDur } from './format.js';
import { ZONES, CATS, TOTAL, RATE, hhmm, hoursLabel } from './campus.js';
import { L, A, isIdle } from './data.js';
import { predictShort, hybridForecast } from './forecast.js';

export const SPIKE_ACTION = {
  admin: at => `Raise AC setpoint by 1°C from ${hhmm(at - 2)} and defer print/copy batches`,
  library: at => `Dim reading-room lighting to 70% from ${hhmm(at - 2)} and cycle AHUs at 50%`,
  server: () => 'Shift backup & batch jobs to 23:00',
  'lecture-a': at => `Pre-cool Hall A before ${hhmm(at - 4)}, then stagger class start by 30 min`,
  'lecture-b': at => `Pre-cool Hall B before ${hhmm(at - 4)}, then stagger class start by 30 min`,
  cafeteria: at => `Pre-cool dining area before ${hhmm(at - 4)} and stagger oven start-up`,
};

export function equipGuess(z) {
  const s = CATS.slice().sort((a, b) => z.breakdown[b.key] - z.breakdown[a.key]);
  return { short: s[0].short, long: `${s[0].equip} (${Math.round(z.breakdown[s[0].key] * 100)}% of load profile) and ${s[1].equip}` };
}

/** 30-min rolling average as % of rated capacity — damps single-interval noise before thresholding. */
export const smoothPct = (z, k) => ((L(z.id, k) + L(z.id, k - 1)) / 2) / z.peakLoad * 100;

/** Threshold state machine with hysteresis (warn clears 5 pts below, crit 3 pts below). */
export function nextLevel(lvl, pct, th) {
  if (th.critOn && pct >= th.crit) return 'crit';
  if (lvl === 'crit' && th.critOn && pct >= th.crit - 3) return 'crit';
  if (th.warnOn && pct >= th.warn) return 'warn';
  if ((lvl === 'warn' || lvl === 'crit') && th.warnOn && pct >= th.warn - 5) return 'warn';
  return 'normal';
}

/** Replays the week against a rule set: how often (and how long) it would have alerted. */
export function countTriggers(z, th) {
  let lvl = 'normal', warn = 0, crit = 0, idle = 0, inIdle = false, alertSlots = 0;
  for (let k = 0; k < TOTAL; k++) {
    const nl = nextLevel(lvl, smoothPct(z, k), th);
    if (nl !== lvl) { if (nl === 'crit') crit++; else if (nl === 'warn' && lvl === 'normal') warn++; lvl = nl; }
    const id = th.idleOn && isIdle(z, k);
    if (id && !inIdle) idle++;
    if (lvl !== 'normal' || id) alertSlots++;
    inIdle = id;
  }
  return { warn, crit, idle, total: warn + crit + idle, hours: alertSlots / 4 };
}

export function createEngine() { return { alerts: [], ctx: {}, seq: 0, lastAbs: -Infinity }; }

/** Advances the alert engine by one interval. Mutates E; cfg = { thresholds, customRules }. */
export function engineStep(E, abs, cfg) {
  const push = a => {
    const al = { id: ++E.seq, abs, status: a.sev === 'info' ? 'cleared' : 'active', ...a };
    E.alerts.unshift(al);
    if (E.alerts.length > 200) E.alerts.length = 200;
    return al;
  };
  const clear = al => { if (al && al.status === 'active') al.status = 'cleared'; };

  ZONES.forEach(z => {
    const c = E.ctx[z.id] || (E.ctx[z.id] = { level: 'normal', idleRun: 0, idleWaste: 0, idleAlert: null, loadAlert: null, fcAlert: null, fcTarget: 0, anom: false, custom: {} });
    const th = cfg.thresholds[z.id];
    const v = L(z.id, abs), pct = smoothPct(z, abs), vs = pct * z.peakLoad / 100;
    const base = { zoneId: z.id, zone: z.name };

    // 1. Capacity thresholds
    const lvl = nextLevel(c.level, pct, th);
    if (lvl !== c.level) {
      if (lvl === 'crit') {
        clear(c.loadAlert); clear(c.fcAlert); c.fcAlert = null;
        c.loadAlert = push({ ...base, sev: 'critical', type: 'load', title: `Load exceeded ${th.crit}% capacity`, detail: `${z.name} is drawing ${fkW(vs)} (30-min average) — ${fPct(pct)} of its ${z.peakLoad} kW rated capacity. Sustained operation above ${th.crit}% risks breaker trips and maximum-demand penalties.`, action: SPIKE_ACTION[z.id](abs) });
      } else if (lvl === 'warn' && c.level === 'normal') {
        clear(c.fcAlert); c.fcAlert = null;
        c.loadAlert = push({ ...base, sev: 'warning', type: 'load', title: `Load above ${th.warn}% threshold`, detail: `${z.name} reached ${fkW(vs)} (${fPct(pct)} of capacity). HVAC and ${equipGuess(z).short} are the largest contributors at this hour.`, action: SPIKE_ACTION[z.id](abs) });
      } else if (lvl === 'normal') {
        clear(c.loadAlert); c.loadAlert = null;
        push({ ...base, sev: 'info', type: 'recovery', title: 'Returned to normal range', detail: `Load eased to ${fkW(v)} (${fPct(v / z.peakLoad * 100)} of capacity).`, action: 'No action needed — continue monitoring.' });
      }
      c.level = lvl;
    }

    // 2. Idle draw outside operating hours
    const idle = th.idleOn && isIdle(z, abs);
    if (idle) {
      c.idleRun++; c.idleWaste += (v - z.baseLoad * 0.3) * 0.25;
      const eq = equipGuess(z);
      if (c.idleRun === 1) c.idleAlert = push({ ...base, sev: 'critical', type: 'idle', title: '', detail: '', action: `Deploy smart power strips with scheduled cutoff at ${pad(z.operatingHours[1])}:00; physically check ${eq.short}.` });
      if (c.idleAlert) {
        c.idleAlert.title = `Idle draw: ${eq.short} on for ${fmtDur(c.idleRun * 15)}`;
        c.idleAlert.detail = `${z.name} is drawing ${fkW(v)} outside operating hours (${hoursLabel(z)}) — ${n1(v / (z.baseLoad * 0.3))}× its expected standby load. Likely cause: ${eq.long}. Waste so far: ${n1(c.idleWaste)} kWh (${fINR(c.idleWaste * RATE)}).`;
      }
    } else if (c.idleRun > 0) {
      push({ ...base, sev: 'info', type: 'recovery', title: `Idle draw ended after ${fmtDur(c.idleRun * 15)}`, detail: `Total avoidable waste: ${n1(c.idleWaste)} kWh ≈ ${fINR(c.idleWaste * RATE)}.`, action: `Schedule auto-shutdown at ${pad(z.operatingHours[1])}:00 to prevent recurrence.` });
      clear(c.idleAlert); c.idleAlert = null; c.idleRun = 0; c.idleWaste = 0;
    }

    // 3. 24/7 zone anomalies (no "off-hours" to detect idle draw against)
    if (z.id === 'server') {
      const an = !!A(z.id, abs);
      if (an && !c.anom) push({ ...base, sev: 'warning', type: 'anomaly', title: 'Unusual overnight cooling surge', detail: `Server Room jumped to ${fkW(v)} at ${hhmm(abs)} — ${fPct(v / z.baseLoad * 100 - 100)} above its overnight baseline. Likely a CRAC unit short-cycling or a blocked cold aisle.`, action: 'Inspect CRAC units and install blanking panels in open rack slots.' });
      c.anom = an;
    }

    // 4. Predicted spikes (2-hour look-ahead)
    if (th.warnOn && c.level === 'normal') {
      if (c.fcAlert && abs > c.fcTarget + 2) { clear(c.fcAlert); c.fcAlert = null; }
      if (!c.fcAlert) {
        const st = predictShort(k => L(z.id, k), abs, 8), fc = hybridForecast(z, abs, st, 8), lim = z.peakLoad * th.warn / 100;
        const t = fc.pred.findIndex(p => p > lim);
        if (t >= 0) {
          const at = abs + t + 1; c.fcTarget = at;
          c.fcAlert = push({ ...base, sev: 'warning', type: 'forecast', title: `Spike predicted at ${hhmm(at)}`, detail: `Forecast engine projects ${fkW(fc.pred[t])} (${fPct(fc.pred[t] / z.peakLoad * 100)} of capacity) in ${(t + 1) * 15} min — short-term trend ${st.trend} at ${n1(st.slope * 4)} kW/h.`, action: SPIKE_ACTION[z.id](at) });
        }
      }
    }

    // 5. Custom rules
    cfg.customRules.filter(r => r.zoneId === z.id).forEach(r => {
      const over = v > r.kw;
      if (over && !c.custom[r.id]) c.custom[r.id] = push({ ...base, sev: r.severity, type: 'custom', title: `Custom rule: load > ${r.kw} kW`, detail: `${z.name} drew ${fkW(v)}, exceeding your custom limit of ${r.kw} kW.`, action: 'Review the zone schedule against your custom limit.' });
      else if (!over && c.custom[r.id]) { clear(c.custom[r.id]); delete c.custom[r.id]; }
    });
  });
}

/** Forecast-view list: next-6h threshold crossings plus idle-draw risk after closing time. */
export function upcomingPeaks(m, thresholds) {
  const list = [];
  m.zones.forEach(z => {
    const th = thresholds[z.id];
    if (th.warnOn) {
      const lim = z.peakLoad * th.warn / 100;
      let t0 = null, mx = 0;
      for (let t = 1; t <= 24; t++) {
        const p = z.fc.pred[t - 1];
        if (p > lim) { if (t0 === null) t0 = t; mx = Math.max(mx, p); } else if (t0 !== null) break;
      }
      if (t0 !== null) {
        const at = m.abs + t0, pct = mx / z.peakLoad * 100;
        list.push({ key: `${z.id}-spike-${Math.round(at / 4)}`, type: 'spike', zone: z, at, kw: mx, pct, sev: th.critOn && pct >= th.crit ? 'critical' : 'warning', action: SPIKE_ACTION[z.id](at) });
      }
    }
    if (th.idleOn && z.id !== 'server' && z.open && z.weekIdleMin > 0) {
      const close = m.dayStart + z.operatingHours[1] * 4;
      if (close > m.abs && close - m.abs <= 24) list.push({ key: `${z.id}-idle-${close}`, type: 'idle', zone: z, at: close, kw: z.baseLoad * 2.5, pct: z.baseLoad * 2.5 / z.peakLoad * 100, sev: 'info', idleMin: z.weekIdleMin, action: `Schedule auto-shutdown at ${pad(z.operatingHours[1])}:00` });
    }
  });
  return list.sort((a, b) => a.at - b.at).slice(0, 5);
}
