import { fkW, fPct, n0, n1, pad } from './format.js';
import { CAPACITY, RATE, OFFPEAK_RATE, DEMAND_CHARGE, hhmm } from './campus.js';

/** Builds one recommendation card per rule, aggregated across every zone the rule applies to. */
export function buildRecs(m) {
  const Z = m.zones, out = [];
  const names = arr => arr.map(z => z.name);
  const others = arr => (arr.length > 1 ? ` (plus ${arr.slice(1).map(z => z.short).join(', ')})` : '');

  const ls = Z.filter(z => z.peakWeek > z.peakLoad * 0.8).sort((a, b) => b.peakWeek / b.peakLoad - a.peakWeek / a.peakLoad);
  if (ls.length) {
    const p = ls[0], kwh = ls.reduce((s, z) => s + z.peakLoad * 0.15 * 4, 0);
    out.push({ id: 'load-shift', category: 'Load Management', icon: 'ArrowRightLeft', impact: 'high', title: 'Shift Non-Critical Load to Off-Peak',
      desc: `${p.name} hit ${fPct(p.peakWeek / p.peakLoad * 100)} of its ${p.peakLoad} kW capacity at ${hhmm(p.peakWeekAt)} this week${ls.length > 1 ? `, and ${ls.length - 1} other zone${ls.length > 2 ? 's' : ''} crossed 80%` : ''}. Schedule batch computing, backup operations and non-essential HVAC cycling to the 22:00–05:00 window when the grid tariff drops to ₹5.2/kWh.`,
      kwhDay: kwh, kwhLabel: 'shifted per day', inrDay: kwh * (RATE - OFFPEAK_RATE), zones: names(ls), toast: 'Batch jobs & HVAC pre-cycling moved to the 22:00–05:00 off-peak window' });
  }

  const idle = Z.filter(z => z.weekIdleMin > 0).sort((a, b) => b.weekIdleWaste - a.weekIdleWaste);
  if (idle.length) {
    const p = idle[0], kwh = idle.reduce((s, z) => s + z.weekIdleWaste, 0) / 7;
    out.push({ id: 'idle-shutdown', category: 'Waste Elimination', icon: 'PowerOff', impact: 'medium', title: 'Auto-Shutdown Idle Equipment',
      desc: `Detected ${p.weekIdleMin} minutes of unnecessary draw in ${p.name} during non-operating hours this week (${n1(p.weekIdleWaste)} kWh wasted)${others(idle)}. Deploy smart power strips with scheduled cutoff at ${pad(p.operatingHours[1])}:00.`,
      kwhDay: kwh, kwhLabel: 'saved per day', inrDay: kwh * RATE, zones: names(idle), toast: `Smart strips armed — auto-cutoff scheduled after closing in ${idle.length} zone${idle.length > 1 ? 's' : ''}` });
  }

  const hv = Z.filter(z => z.breakdown.hvac > 0.35 && z.id !== 'server').sort((a, b) => b.peakLoad * b.breakdown.hvac - a.peakLoad * a.breakdown.hvac);
  if (hv.length) {
    const p = hv[0], kwh = hv.reduce((s, z) => s + z.peakLoad * z.breakdown.hvac * 0.4 * 8, 0);
    out.push({ id: 'hvac-occupancy', category: 'HVAC Optimization', icon: 'Thermometer', impact: 'high', title: 'Occupancy-Based HVAC Scheduling',
      desc: `HVAC accounts for ${Math.round(p.breakdown.hvac * 100)}% of ${p.name}'s consumption${others(hv)}. Install occupancy sensors to reduce cooling by 40% in unoccupied periods, and start pre-cooling at ${pad(p.operatingHours[0] - 1)}:30 — 30 min before ${p.id.startsWith('lecture') ? 'the first class' : 'opening'}.`,
      kwhDay: kwh, kwhLabel: 'saved per day', inrDay: kwh * RATE, zones: names(hv), toast: 'Schedule updated — HVAC will use occupancy-based control' });
  }

  const li = Z.filter(z => z.breakdown.lighting > 0.2).sort((a, b) => b.breakdown.lighting * b.peakLoad - a.breakdown.lighting * a.peakLoad);
  if (li.length) {
    const p = li[0], kwh = li.reduce((s, z) => s + z.peakLoad * z.breakdown.lighting * 0.55 * 10, 0);
    out.push({ id: 'lighting-motion', category: 'Lighting Efficiency', icon: 'Lightbulb', impact: 'medium', title: 'Motion-Sensor Lighting Zones',
      desc: `Lighting draws ${Math.round(p.breakdown.lighting * 100)}% in ${p.name} (${n0(p.sqft)} sq ft)${others(li)}. Retrofit corridors, stacks and low-traffic areas with PIR motion sensors for an expected 55% cut in lighting consumption during partial-occupancy hours.`,
      kwhDay: kwh, kwhLabel: 'saved per day', inrDay: kwh * RATE, zones: names(li), toast: 'Motion-sensor lighting enabled in corridors & low-traffic areas' });
  }

  if (m.peakWeek > CAPACITY * 0.7) {
    const a = m.zmap['lecture-a'], b = m.zmap['lecture-b'];
    const cut = m.peakWeek * 0.18, month = cut * DEMAND_CHARGE;
    out.push({ id: 'peak-stagger', category: 'Demand Management', icon: 'CalendarClock', impact: 'high', title: 'Stagger Class Schedules Across Halls',
      desc: `Lecture Hall A (peak ${hhmm(a.peakWeekAt)}) and Lecture Hall B (peak ${hhmm(b.peakWeekAt)}) hit maximum draw together while campus demand reaches ${fkW(m.peakWeek)} — ${fPct(m.peakWeek / CAPACITY * 100)} of capacity. Staggering timetables by 30 minutes flattens the campus peak by 18%, cutting maximum-demand charges.`,
      kwhDay: 0, peakCut: cut, inrDay: month / 30, inrMonth: month, zones: [a.name, b.name], toast: 'Timetable staggered by 30 min across Lecture Halls A & B' });
  }

  const sv = m.zmap.server;
  if (sv.breakdown.hvac > 0.5) {
    const kwh = sv.peakLoad * 0.55 * 0.27 * 24;
    out.push({ id: 'server-cooling', category: 'Data Center Efficiency', icon: 'Wind', impact: 'high', title: 'Hot/Cold Aisle Containment',
      desc: `Server room HVAC is ${Math.round(sv.breakdown.hvac * 100)}% of its total draw (currently ${fkW(sv.catKw.hvac)} of ${fkW(sv.cur)}). Hot/cold aisle containment with blanking panels can reduce cooling energy by 25–30% while keeping inlet temperatures within ASHRAE limits.`,
      kwhDay: kwh, kwhLabel: 'saved per day', inrDay: kwh * RATE, zones: [sv.name], toast: 'Work order raised — aisle containment for Server Room' });
  }

  out.forEach(r => { if (r.inrMonth == null) r.inrMonth = r.inrDay * 30; });
  return out.sort((a, b) => b.inrMonth - a.inrMonth);
}
