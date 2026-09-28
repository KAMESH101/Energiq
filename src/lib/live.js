import { CATS, CAPACITY, RATE, PER_DAY, slotFrac, slotStartMs } from './campus.js';
import { L } from './data.js';

/**
 * Per-second view of the 15-minute model: each zone's load glides from the current reading toward the
 * next forecast reading, with a small smooth fluctuation, and today's energy/cost accrue continuously.
 * Heavy series (forecasts, history) are shared with the interval model, so views can memoise them on
 * `model.abs` and layer the live values (`liveX`, `cur`, …) on top every second.
 */
export function withLive(model, ms) {
  const frac = slotFrac(ms), t = ms / 1000;
  const elapsedH = Math.max((model.slot + frac) / 4, 1 / 60);
  const zones = model.zones.map((z, i) => {
    const target = z.fc.pred[0] ?? z.cur;
    const amp = z.id === 'server' ? 0.012 : 0.03;
    const jitter = amp * (Math.sin(t / 1.9 + i * 1.7) + 0.6 * Math.sin(t / 0.7 + i * 2.9)) / 1.6;
    const cur = Math.max(0, (z.cur + (target - z.cur) * frac) * (1 + jitter));
    // The interval model books the whole current interval; count only the part that has elapsed.
    const kwhToday = z.kwhToday - z.cur * 0.25 + (z.cur + cur) / 2 * 0.25 * frac;
    const kwhYest = z.kwhYest - L(z.id, model.abs - PER_DAY) * 0.25 * (1 - frac);
    const catKw = {}; CATS.forEach(c => { catKw[c.key] = cur * z.breakdown[c.key]; });
    const peakNow = cur > z.peakToday;
    return {
      ...z, cur, pct: cur / z.peakLoad * 100, kwhToday, kwhYest, catKw, avgToday: kwhToday / elapsedH,
      peakToday: peakNow ? cur : z.peakToday, peakAt: peakNow ? model.abs : z.peakAt,
    };
  });
  const cur = zones.reduce((s, z) => s + z.cur, 0);
  const kwhToday = zones.reduce((s, z) => s + z.kwhToday, 0);
  const kwhYest = zones.reduce((s, z) => s + z.kwhYest, 0);

  // Accuracy: the newest point is the interval in progress, scored against the live reading.
  const last = model.acc.last.slice(), lp = last[last.length - 1];
  last[last.length - 1] = { ...lp, a: cur, err: Math.abs(cur - lp.p) / Math.max(cur, 1e-6) * 100, live: true };

  return {
    ...model, zones, zmap: Object.fromEntries(zones.map(z => [z.id, z])),
    cur, pct: cur / CAPACITY * 100, kwhToday, kwhYest, costToday: kwhToday * RATE,
    trendPct: kwhYest > 0 ? (kwhToday - kwhYest) / kwhYest * 100 : 0,
    peakToday: Math.max(model.peakToday, cur),
    acc: { ...model.acc, last, mape: last.reduce((s, o) => s + o.err, 0) / last.length },
    nowMs: ms, frac, liveX: model.slot + frac,
    nextReadingSec: (1 - frac) * 900,
  };
}

/** Seconds from the live clock until interval `k` starts (negative = already started). */
export const secsUntil = (model, k) => (slotStartMs(k) - model.nowMs) / 1000;
