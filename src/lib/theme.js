import { createContext, useContext } from 'react';

/** Resolves the CSS design tokens to concrete colours for SVG / Recharts props. */
export function readPalette() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  return {
    green: g('--energy-green'), amber: g('--energy-amber'), red: g('--energy-red'), blue: g('--energy-blue'), purple: g('--energy-purple'), cyan: g('--energy-cyan'),
    t1: g('--text-primary'), t2: g('--text-secondary'), t3: g('--text-tertiary'),
    s1: g('--surface-1'), s2: g('--surface-2'), s3: g('--surface-3'), grid: g('--border-subtle'), border: g('--border-default'),
  };
}

export const PalCtx = createContext(null);
export const usePal = () => useContext(PalCtx);

export const sevColor = (pal, s) => (s === 'critical' ? pal.red : s === 'warning' ? pal.amber : pal.green);
export const loadColor = (pal, pct) => (pct < 60 ? pal.green : pct < 85 ? pal.amber : pal.red);
export const axisTick = pal => ({ fill: pal.t3, fontSize: 11, fontFamily: 'JetBrains Mono' });
