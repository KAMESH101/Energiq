import { clamp } from './format.js';
import { ZONES, TOTAL, PER_DAY, DAYS, inHours, dayFactor, wrap, slotOf } from './campus.js';

/* Simulated data engine: deterministic (seeded) 7-day, 15-minute load profile per zone. */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function modelLoad(z, slot, day) {
  const h = slot / 4, [s, e] = z.operatingHours;
  const l = inHours(z, h) ? z.baseLoad + (z.peakLoad - z.baseLoad) * Math.sin(Math.PI * (h - s) / (e - s)) ** 2 : z.baseLoad * 0.3;
  return l * dayFactor(z, day);
}

export function generateData(seed = 20260927) {
  const rng = mulberry32(seed);
  const data = {};
  ZONES.forEach(z => {
    const load = new Float32Array(TOTAL), anom = new Uint8Array(TOTAL);
    let zs = 0; // AR(1) state — metered load noise is autocorrelated interval to interval
    for (let i = 0; i < TOTAL; i++) {
      const d = Math.floor(i / PER_DAY), s = i % PER_DAY;
      // Gaussian noise: marginal σ = peakLoad × 6% while operating; scaled to standby level when closed
      const sd = inHours(z, s / 4) ? z.peakLoad * 0.06 : z.baseLoad * 0.06;
      zs = 0.85 * zs + Math.sqrt(1 - 0.85 * 0.85) * gauss(rng);
      load[i] = clamp(modelLoad(z, s, d) + zs * sd, z.baseLoad * 0.08, z.peakLoad * 1.03); // feeder breaker caps draw near rating
    }
    // Anomaly injection: 3 per zone per week (forgotten-equipment runs of 45 min – 2 h)
    let placed = 0, guard = 0;
    const off = []; for (let k = 0; k < PER_DAY; k++) if (!inHours(z, k / 4)) off.push(k);
    while (placed < 3 && guard++ < 1000) {
      const d = Math.floor(rng() * DAYS);
      const s = z.id === 'server' ? 2 + Math.floor(rng() * 18) : off[Math.floor(rng() * off.length)];
      const len = 3 + Math.floor(rng() * 6), start = d * PER_DAY + s;
      let ok = true;
      for (let k = 0; k < len; k++) {
        const j = start + k;
        if (j >= TOTAL || anom[j] || (z.id !== 'server' && inHours(z, (j % PER_DAY) / 4))) { ok = false; break; }
      }
      if (!ok) continue;
      for (let k = 0; k < len; k++) {
        const j = start + k; anom[j] = 1;
        load[j] = z.id === 'server' ? z.baseLoad * 1.65 * (1 + gauss(rng) * 0.02) : z.baseLoad * 2.5 * (1 + gauss(rng) * 0.04);
      }
      placed++;
    }
    data[z.id] = { load, anom };
  });
  return data;
}

export const DATA = generateData();
export const TOTAL_LOAD = (() => {
  const a = new Float32Array(TOTAL);
  for (let i = 0; i < TOTAL; i++) { let s = 0; ZONES.forEach(z => { s += DATA[z.id].load[i]; }); a[i] = s; }
  return a;
})();
export const WEEK_KWH = TOTAL_LOAD.reduce((s, v) => s + v * 0.25, 0);

export const L = (zid, k) => DATA[zid].load[wrap(k)];
export const A = (zid, k) => DATA[zid].anom[wrap(k)];
export const TOT = k => TOTAL_LOAD[wrap(k)];
export const ANY_ANOM = k => ZONES.some(z => DATA[z.id].anom[wrap(k)]);
export const isIdle = (z, k) => z.id !== 'server' && !inHours(z, slotOf(k) / 4) && L(z.id, k) > z.baseLoad * 0.6;
