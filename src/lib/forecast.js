import { ZONES, ZMAP, PER_DAY, dayFactor, dayOf } from './campus.js';
import { L, A, TOT } from './data.js';

/* Prediction engine — WMA-12 + linear trend extrapolation, blended with a seasonal profile. */

const WMA_W = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
const WMA_SUM = WMA_W.reduce((a, b) => a + b, 0);
const WMA_LAG = WMA_W.reduce((s, w, k) => s + w * (11 - k), 0) / WMA_SUM; // centroid lag of the WMA (~3.8 intervals)

/** Spec algorithm: 24 intervals of history in, H intervals of prediction out. */
export function predictShort(get, now, H = 8) {
  // Step 1: WMA-12 evaluated at each of the last 12 positions
  const w = [];
  for (let j = 0; j < 12; j++) {
    const e = now - 11 + j;
    let s = 0; for (let k = 0; k < 12; k++) s += WMA_W[k] * get(e - 11 + k);
    w.push(s / WMA_SUM);
  }
  // Step 2: linear regression on the 12 WMA points
  const mx = 5.5, my = w.reduce((a, b) => a + b, 0) / 12;
  let sxy = 0, sxx = 0;
  for (let x = 0; x < 12; x++) { sxy += (x - mx) * (w[x] - my); sxx += (x - mx) ** 2; }
  const slope = sxy / sxx;
  // Step 4: residual stddev (actual − wma)
  let ss = 0; for (let x = 0; x < 12; x++) { const r = get(now - 11 + x) - w[x]; ss += r * r; }
  const sd = Math.sqrt(ss / 12);
  // Step 3: extrapolation (WMA shifted forward by its centroid lag)
  const wma = w[11], pred = [], upper = [], lower = [];
  for (let t = 1; t <= H; t++) {
    const p = Math.max(0, wma + slope * (t + WMA_LAG)), b = sd * (1 + t * 0.1);
    pred.push(p); upper.push(p + b); lower.push(Math.max(0, p - b));
  }
  return { pred, upper, lower, slope, sd, wma, trend: slope > 0 ? 'rising' : 'falling' };
}

/** 6-day seasonal profile at absolute interval j (same time-of-day, day-factor normalised, anomalies excluded). */
export function seasonalAt(z, j, now) {
  let s = 0, n = 0;
  for (let d = 1; d <= 6; d++) {
    const k = j - PER_DAY * d;
    if (k > now || A(z.id, k)) continue;
    s += L(z.id, k); n += dayFactor(z, dayOf(k));
  }
  return (n ? s / n : L(z.id, now) / dayFactor(z, dayOf(now))) * dayFactor(z, dayOf(j));
}

/** Blend WMA + trend with the seasonal profile; the current deviation from the seasonal norm decays
    forward (AR-style), and the trend model's weight fades with horizon. */
export function hybridForecast(z, now, st, H = 96) {
  const pred = [], upper = [], lower = [];
  const sdS = Math.max(st.sd, z.peakLoad * 0.045);
  const dev = L(z.id, now) - seasonalAt(z, now, now);
  for (let t = 1; t <= H; t++) {
    const a = 0.1 * Math.exp(-(t - 1) / 4);
    const stp = t <= st.pred.length ? st.pred[t - 1] : Math.max(0, st.wma + st.slope * (t + WMA_LAG));
    const p = Math.max(0, a * stp + (1 - a) * (seasonalAt(z, now + t, now) + dev * Math.pow(0.85, t)));
    const b = a * st.sd * (1 + t * 0.1) + (1 - a) * sdS * Math.min(1 + t * 0.1, 3.5);
    pred.push(p); upper.push(p + b); lower.push(Math.max(0, p - b));
  }
  return { pred, upper, lower };
}

export const oneStep = (zid, k) => hybridForecast(ZMAP[zid], k - 1, predictShort(j => L(zid, j), k - 1, 1), 1).pred[0];
export const oneStepTotal = k => ZONES.reduce((s, z) => s + oneStep(z.id, k), 0);

/** Accuracy tracking: 15-min-ahead campus predictions — MAPE over the last 20, R² over the last 24 h. */
export function computeAccuracy(abs) {
  const pts = [];
  for (let k = abs - 95; k <= abs; k++) pts.push({ k, p: oneStepTotal(k), a: TOT(k) });
  const last = pts.slice(-20).map(o => ({ ...o, err: Math.abs(o.a - o.p) / Math.max(o.a, 1e-6) * 100 }));
  const mape = last.reduce((s, o) => s + o.err, 0) / last.length;
  const mean = pts.reduce((s, o) => s + o.a, 0) / pts.length;
  let ssr = 0, sst = 0;
  pts.forEach(o => { ssr += (o.a - o.p) ** 2; sst += (o.a - mean) ** 2; });
  return { last, mape, r2: sst > 0 ? 1 - ssr / sst : 0 };
}
