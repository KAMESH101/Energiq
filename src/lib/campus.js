import { pad } from './format.js';

/* Building profile — VIT Smart Campus (ASHRAE / BEE India benchmarks) */
export const ZONES = [
  { id: 'admin', name: 'Admin Block', short: 'Admin', icon: 'Building2', baseLoad: 12, peakLoad: 48, operatingHours: [8, 18], breakdown: { hvac: 0.42, lighting: 0.28, computing: 0.22, appliances: 0.08 }, sqft: 8000, energyRate: 8.5 },
  { id: 'library', name: 'Central Library', short: 'Library', icon: 'BookOpen', baseLoad: 8, peakLoad: 35, operatingHours: [7, 22], breakdown: { hvac: 0.38, lighting: 0.35, computing: 0.20, appliances: 0.07 }, sqft: 12000, energyRate: 8.5 },
  { id: 'server', name: 'Server Room', short: 'Server Room', icon: 'Server', baseLoad: 30, peakLoad: 55, operatingHours: [0, 24], breakdown: { hvac: 0.55, lighting: 0.05, computing: 0.38, appliances: 0.02 }, sqft: 2000, energyRate: 8.5 },
  { id: 'lecture-a', name: 'Lecture Hall A', short: 'Lecture A', icon: 'GraduationCap', baseLoad: 5, peakLoad: 42, operatingHours: [8, 17], breakdown: { hvac: 0.45, lighting: 0.25, computing: 0.18, appliances: 0.12 }, sqft: 6000, energyRate: 8.5 },
  { id: 'lecture-b', name: 'Lecture Hall B', short: 'Lecture B', icon: 'GraduationCap', baseLoad: 5, peakLoad: 40, operatingHours: [8, 17], breakdown: { hvac: 0.45, lighting: 0.25, computing: 0.18, appliances: 0.12 }, sqft: 5500, energyRate: 8.5 },
  { id: 'cafeteria', name: 'Cafeteria', short: 'Cafeteria', icon: 'UtensilsCrossed', baseLoad: 10, peakLoad: 60, operatingHours: [6, 21], breakdown: { hvac: 0.30, lighting: 0.15, computing: 0.05, appliances: 0.50 }, sqft: 4000, energyRate: 8.5 },
];
export const ZMAP = Object.fromEntries(ZONES.map(z => [z.id, z]));

export const CATS = [
  { key: 'hvac', label: 'HVAC', color: 'blue', short: 'AC units', equip: 'AC / HVAC units' },
  { key: 'lighting', label: 'Lighting', color: 'amber', short: 'lighting', equip: 'lighting circuits' },
  { key: 'computing', label: 'Computing', color: 'purple', short: 'PCs & projectors', equip: 'PCs, projectors & displays' },
  { key: 'appliances', label: 'Appliances', color: 'cyan', short: 'kitchen appliances', equip: 'kitchen & plug-load appliances' },
];

export const CAPACITY = ZONES.reduce((s, z) => s + z.peakLoad, 0);
export const RATE = 8.5, OFFPEAK_RATE = 5.2, DEMAND_CHARGE = 200;

/* Time — 7 days × 96 fifteen-minute intervals, Mon 21 Sep 2026 → Sun 27 Sep 2026.
   The absolute tick index keeps advancing; the dataset loops weekly. */
export const PER_DAY = 96, DAYS = 7, TOTAL = PER_DAY * DAYS;
export const START_IDX = 3 * PER_DAY + 36; // Thursday 09:00 — gives 3 days of history at launch
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const wrap = i => ((i % TOTAL) + TOTAL) % TOTAL;
export const slotOf = i => ((i % PER_DAY) + PER_DAY) % PER_DAY;
export const dayOf = i => Math.floor(wrap(i) / PER_DAY);
export const weekdayIdx = d => ((d % 7) + 7) % 7;
export const hhmm = i => { const s = slotOf(i); return `${pad(Math.floor(s / 4))}:${pad((s % 4) * 15)}`; };

export function dateOf(abs) {
  const d = Math.floor(abs / PER_DAY), wd = weekdayIdx(d);
  const dt = new Date(Date.UTC(2026, 8, 21 + d));
  return {
    weekday: WEEKDAYS_LONG[wd], wd: WEEKDAYS[wd],
    label: `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`,
    long: `${MONTHS_LONG[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`,
    iso: dt.toISOString().slice(0, 10),
  };
}

export const inHours = (z, hour) => hour >= z.operatingHours[0] && hour < z.operatingHours[1];
export const dayFactor = (z, day) => (z.id === 'server' ? (day >= 5 ? 0.9 : 1) : day === 5 ? 0.45 : day === 6 ? 0.25 : 1);
export const hoursLabel = z => (z.operatingHours[1] - z.operatingHours[0] >= 24 ? '24/7' : `${pad(z.operatingHours[0])}:00–${pad(z.operatingHours[1])}:00`);
