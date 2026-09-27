import { ZONES, CATS, CAPACITY, RATE, PER_DAY, TOTAL, slotOf, inHours } from './campus.js';
import { L, A, TOT, isIdle } from './data.js';
import { predictShort, hybridForecast, computeAccuracy } from './forecast.js';

/** Everything the dashboard derives from the dataset at a given absolute tick. */
export function computeModel(abs) {
  const slot = slotOf(abs), dayStart = abs - slot;
  const zones = ZONES.map(z => {
    const get = k => L(z.id, k);
    const cur = get(abs);
    const st = predictShort(get, abs, 8);
    const fc = hybridForecast(z, abs, st, 96);
    let kwhToday = 0, kwhYest = 0, peakToday = 0, peakAt = abs, idleMinToday = 0, idleWasteToday = 0, idleFirst = null, n = 0;
    for (let k = dayStart; k <= abs; k++) {
      const v = get(k); kwhToday += v * 0.25; kwhYest += get(k - PER_DAY) * 0.25; n++;
      if (v > peakToday) { peakToday = v; peakAt = k; }
      if (isIdle(z, k)) { idleMinToday += 15; idleWasteToday += (v - z.baseLoad * 0.3) * 0.25; if (idleFirst === null) idleFirst = k; }
    }
    let peakWeek = 0, peakWeekAt = abs, weekIdleMin = 0, weekIdleWaste = 0;
    for (let k = abs - TOTAL + 1; k <= abs; k++) {
      const v = get(k);
      if (v > peakWeek && !A(z.id, k)) { peakWeek = v; peakWeekAt = k; }
      if (isIdle(z, k)) { weekIdleMin += 15; weekIdleWaste += (v - z.baseLoad * 0.3) * 0.25; }
    }
    let idleRun = 0; while (idleRun < PER_DAY && isIdle(z, abs - idleRun)) idleRun++;
    const catKw = {}; CATS.forEach(c => { catKw[c.key] = cur * z.breakdown[c.key]; });
    return {
      ...z, cur, pct: cur / z.peakLoad * 100, anomaly: !!A(z.id, abs), open: inHours(z, slot / 4),
      idleNow: idleRun > 0, idleRunMin: idleRun * 15, st, fc, kwhToday, kwhYest, avgToday: kwhToday * 4 / n,
      peakToday, peakAt, idleMinToday, idleWasteToday, idleFirst, peakWeek, peakWeekAt, weekIdleMin, weekIdleWaste, catKw,
    };
  });

  const cur = zones.reduce((s, z) => s + z.cur, 0);
  const kwhToday = zones.reduce((s, z) => s + z.kwhToday, 0);
  const kwhYest = zones.reduce((s, z) => s + z.kwhYest, 0);

  // Campus forecast = Σ zone forecasts; band half-widths combine in quadrature
  const fcTotal = { pred: [], upper: [], lower: [] };
  for (let t = 0; t < 96; t++) {
    let p = 0, v = 0;
    zones.forEach(z => { p += z.fc.pred[t]; v += ((z.fc.upper[t] - z.fc.lower[t]) / 2) ** 2; });
    const b = Math.sqrt(v);
    fcTotal.pred.push(p); fcTotal.upper.push(p + b); fcTotal.lower.push(Math.max(0, p - b));
  }
  let predPeak = 0, predPeakAt = abs + 1;
  for (let t = 1; t <= 24; t++) if (fcTotal.pred[t - 1] > predPeak) { predPeak = fcTotal.pred[t - 1]; predPeakAt = abs + t; }
  let peakToday = 0, peakTodayAt = abs;
  for (let k = dayStart; k <= abs; k++) if (TOT(k) > peakToday) { peakToday = TOT(k); peakTodayAt = k; }
  let peakWeek = 0; for (let k = abs - TOTAL + 1; k <= abs; k++) peakWeek = Math.max(peakWeek, TOT(k));

  return {
    abs, slot, dayStart, zones, zmap: Object.fromEntries(zones.map(z => [z.id, z])),
    cur, pct: cur / CAPACITY * 100, kwhToday, kwhYest, costToday: kwhToday * RATE,
    trendPct: kwhYest > 0 ? (kwhToday - kwhYest) / kwhYest * 100 : 0,
    fcTotal, predPeak, predPeakAt, peakToday, peakTodayAt, peakWeek, acc: computeAccuracy(abs),
  };
}
