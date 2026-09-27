import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, ArrowRightLeft, Bell, BellOff, BookOpen, Building2, CalendarClock, Check, CheckCheck, ChevronDown, ChevronUp,
  CircleAlert, CircleCheck, Clock, CornerDownRight, Download, Gauge, GraduationCap, History, IndianRupee, Info, Keyboard,
  LayoutDashboard, Lightbulb, Moon, Pause, Play, Plus, PowerOff, RotateCcw, Server, Sparkles, Sun, Thermometer, Trash2,
  TrendingDown, TrendingUp, TriangleAlert, UtensilsCrossed, Wind, Wrench, X, Zap, ZoomOut,
} from 'lucide-react';
import { safe } from '../lib/format.js';
import { usePal, sevColor } from '../lib/theme.js';

// Explicit map (not `import *`) so the bundle only ships the icons we use.
const ICONS = {
  Activity, ArrowRightLeft, Bell, BellOff, BookOpen, Building2, CalendarClock, Check, CheckCheck, ChevronDown, ChevronUp,
  CircleAlert, CircleCheck, Clock, CornerDownRight, Download, Gauge, GraduationCap, History, IndianRupee, Info, Keyboard,
  LayoutDashboard, Lightbulb, Moon, Pause, Play, Plus, PowerOff, RotateCcw, Server, Sparkles, Sun, Thermometer, Trash2,
  TrendingDown, TrendingUp, TriangleAlert, UtensilsCrossed, Wind, Wrench, X, Zap, ZoomOut,
};

export function Icon({ name, size = 16, className = '', style, strokeWidth = 2, fill }) {
  const C = ICONS[name] || Activity;
  return <C size={size} className={className} style={style} strokeWidth={strokeWidth} fill={fill} />;
}

/** True for the first `ms` after mount — charts animate on entry, then update instantly on each tick. */
export function useMountAnim(ms = 1000) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), ms); return () => clearTimeout(t); }, [ms]);
  return on;
}

export function CountUp({ value, format, duration = 800 }) {
  const [disp, setDisp] = useState(0);
  const cur = useRef(0), raf = useRef(0);
  useEffect(() => {
    const from = cur.current, to = safe(value), t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const step = now => {
      const p = Math.min(1, (now - t0) / duration), e = 1 - Math.pow(1 - p, 4);
      cur.current = from + (to - from) * e; setDisp(cur.current);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <span className="kpi-value">{format(disp)}</span>;
}

export function Seg({ options, value, onChange, id }) {
  return (
    <div className="seg" role="tablist">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={value === o.value}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-ind" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, disabled }) {
  const pal = usePal();
  return (
    <button onClick={() => !disabled && onChange(!on)} role="switch" aria-checked={on} disabled={disabled}
      className="relative inline-flex items-center rounded-full transition-colors"
      style={{ width: 40, height: 22, background: on ? pal.green : 'var(--surface-3)', opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className="block rounded-full bg-white shadow"
        style={{ width: 16, height: 16, marginLeft: on ? 21 : 3 }} />
    </button>
  );
}

export function SevDot({ sev, size = 8 }) {
  const pal = usePal(), c = sevColor(pal, sev);
  return <span className="inline-block rounded-full flex-shrink-0" style={{ width: size, height: size, background: c, boxShadow: `0 0 8px ${c}` }} />;
}

export function Badge({ tone, children }) {
  const pal = usePal(), c = pal[tone] || pal.blue;
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
      style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }}>{children}</span>
  );
}

export function EmptyState({ icon = 'Activity', title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)' }}><Icon name={icon} size={18} className="text-ink-2" /></div>
      <div className="text-sm font-medium text-ink-1">{title}</div>
      {sub && <div className="text-xs text-ink-3 max-w-[260px]">{sub}</div>}
    </div>
  );
}

export function Legend2({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dash ? <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke={i.color} strokeWidth="2" strokeDasharray="5 3" /></svg>
            : i.dot ? <span className="w-2 h-2 rounded-full" style={{ background: i.color }} />
              : <span className="swatch" style={{ background: i.color, opacity: i.opacity || 1 }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Tooltip row helper used by every chart tooltip. */
export function TipRow({ color, label, value, valueStyle, swatchOpacity }) {
  return (
    <div className="row">
      <span className="k">{color && <span className="swatch" style={{ background: color, opacity: swatchOpacity }} />}{label}</span>
      <span className="v" style={valueStyle}>{value}</span>
    </div>
  );
}

export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
export const rise = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };
