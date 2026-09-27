import { describe, it, expect } from 'vitest';
import { ZONES, ZMAP, TOTAL, PER_DAY, START_IDX, CAPACITY } from './campus.js';
import { DATA, generateData, L } from './data.js';
import { predictShort, computeAccuracy } from './forecast.js';
import { computeModel } from './model.js';
import { nextLevel, countTriggers, createEngine, engineStep, upcomingPeaks } from './alerts.js';
import { buildRecs } from './recommendations.js';
import { buildReport } from './report.js';

const DEFAULT_TH = Object.fromEntries(ZONES.map(z => [z.id, { warn: 85, crit: 95, warnOn: true, critOn: true, idleOn: z.id !== 'server' }]));

describe('data engine', () => {
  it('is deterministic for a given seed', () => {
    const a = generateData(1), b = generateData(1);
    expect(Array.from(a.admin.load.slice(0, 50))).toEqual(Array.from(b.admin.load.slice(0, 50)));
  });

  it('keeps every reading within physical bounds', () => {
    ZONES.forEach(z => {
      DATA[z.id].load.forEach(v => {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(z.peakLoad * 1.03 + 1e-4); // Float32Array storage rounding
      });
    });
  });

  it('injects exactly 3 anomaly runs per zone per week', () => {
    ZONES.forEach(z => {
      const an = DATA[z.id].anom;
      let runs = 0;
      for (let i = 0; i < TOTAL; i++) if (an[i] && !an[i - 1]) runs++;
      expect(runs).toBe(3);
    });
  });
});

describe('prediction engine', () => {
  it('extrapolates a pure linear ramp exactly', () => {
    const ramp = k => 10 + 2 * k;
    const { pred, trend } = predictShort(ramp, 100, 4);
    expect(trend).toBe('rising');
    pred.forEach((p, i) => expect(p).toBeCloseTo(ramp(101 + i), 6));
  });

  it('confidence band widens with horizon', () => {
    const st = predictShort(k => L('admin', k), START_IDX, 8);
    const widths = st.upper.map((u, i) => u - st.lower[i]);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1] - 1e-9);
  });

  it('keeps weekday-daytime MAPE under 5%', () => {
    const samples = [];
    for (let d = 0; d < 5; d++) for (let h = 10; h <= 17; h += 1) samples.push(computeAccuracy(TOTAL + d * PER_DAY + h * 4).mape);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(avg).toBeLessThan(5);
  });
});

describe('alert engine', () => {
  it('applies hysteresis before clearing a warning', () => {
    const th = DEFAULT_TH.admin;
    expect(nextLevel('normal', 86, th)).toBe('warn');
    expect(nextLevel('warn', 82, th)).toBe('warn');   // within 5-pt band
    expect(nextLevel('warn', 79, th)).toBe('normal');
    expect(nextLevel('warn', 96, th)).toBe('crit');
    expect(nextLevel('crit', 93, th)).toBe('crit');   // within 3-pt band
  });

  it('lowering a threshold never reduces time in alert', () => {
    const z = ZMAP.admin;
    const hi = countTriggers(z, { ...DEFAULT_TH.admin, warn: 85 });
    const lo = countTriggers(z, { ...DEFAULT_TH.admin, warn: 65 });
    expect(lo.hours).toBeGreaterThanOrEqual(hi.hours);
  });

  it('detects idle draw during the week', () => {
    const E = createEngine();
    for (let k = 0; k < TOTAL; k++) engineStep(E, k, { thresholds: DEFAULT_TH, customRules: [] });
    expect(E.alerts.some(a => a.type === 'idle')).toBe(true);
  });

  it('fires custom rules', () => {
    const E = createEngine();
    const rule = { id: 'r1', zoneId: 'server', kw: 1, severity: 'critical' };
    engineStep(E, START_IDX, { thresholds: DEFAULT_TH, customRules: [rule] });
    expect(E.alerts.find(a => a.type === 'custom')?.sev).toBe('critical');
  });
});

describe('model, recommendations & report', () => {
  const m = computeModel(START_IDX);

  it('campus load is the sum of zone loads', () => {
    expect(m.cur).toBeCloseTo(m.zones.reduce((s, z) => s + z.cur, 0), 6);
    expect(m.pct).toBeCloseTo(m.cur / CAPACITY * 100, 6);
  });

  it('produces unique, zone-specific recommendation cards', () => {
    const recs = buildRecs(m);
    expect(recs.length).toBe(6);
    expect(new Set(recs.map(r => r.id)).size).toBe(recs.length);
    expect(new Set(recs.map(r => r.desc)).size).toBe(recs.length);
    recs.forEach(r => expect(r.inrMonth).toBeGreaterThan(0));
  });

  it('lists at most 5 upcoming peaks, time-ordered', () => {
    const peaks = upcomingPeaks(m, DEFAULT_TH);
    expect(peaks.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < peaks.length; i++) expect(peaks[i].at).toBeGreaterThanOrEqual(peaks[i - 1].at);
  });

  it('builds a dated markdown report', () => {
    const { text, name } = buildReport(m, [], buildRecs(m), []);
    expect(name).toBe('energiq-report-2026-09-24.md');
    expect(text).toContain('# EnergiQ Daily Energy Report');
    expect(text).toContain('Prediction Accuracy (MAPE)');
  });
});
