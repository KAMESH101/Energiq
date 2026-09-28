const nf1 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const safe = v => (Number.isFinite(v) ? v : 0);
export const n1 = v => nf1.format(safe(v));
export const n0 = v => nf0.format(Math.round(safe(v)));
export const fkW = v => `${n1(v)} kW`;
export const fkWh = v => `${n0(v)} kWh`;
export const fINR = v => `₹${n0(v)}`;
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fINR2 = v => `₹${nf2.format(safe(v))}`;
export const fkWh2 = v => `${nf2.format(safe(v))} kWh`;
export const fPct = v => `${n1(v)}%`;
export const pad = n => String(n).padStart(2, '0');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const fmtDur = min => {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

/** "just now" / "42s ago" / "12 min ago" / "2h 5m ago" for an age in seconds. */
export const fmtAgo = sec => {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${fmtDur(sec / 60)} ago`;
};

/** Countdown for a duration in seconds: "04:59" under an hour, else "1h 12m". */
export const fmtCountdown = sec => {
  sec = Math.max(0, Math.floor(sec));
  return sec < 3600 ? `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}` : fmtDur(sec / 60);
};
