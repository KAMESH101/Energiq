import { useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clamp } from '../lib/format.js';
import { usePal } from '../lib/theme.js';
import { Icon } from './ui.jsx';

const TOUR = [
  { sel: '[data-tour="kpis"]', title: 'Track your campus energy in real-time', body: 'Live load, today\'s consumption, the predicted peak and money saved — updated every 15 simulated minutes.' },
  { sel: '[data-tour="chart"]', title: 'AI predictions show you what\'s coming', body: 'The dashed purple line is the forecast; the shaded band is its confidence interval, widening as it looks further ahead.' },
  { sel: '[data-tour="nav-savings"]', title: 'Get actionable recommendations to cut waste', body: 'Zone-specific schedules with rupee impact. Apply them with one click.' },
];

export function Tour({ step, onNext, onSkip }) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    const target = () => [...document.querySelectorAll(TOUR[step].sel)].find(e => e.getClientRects().length && e.offsetParent !== null);
    const measure = () => {
      const el = target();
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    };
    // window.scrollTo (not scrollIntoView) so embedding frames are never scrolled
    const el = target();
    if (el && step < 2) {
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - Math.max(80, (window.innerHeight - r.height) / 2 - 60)), behavior: 'smooth' });
    }
    measure();
    const t1 = setTimeout(measure, 350), t2 = setTimeout(measure, 700);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [step]);

  const W = window.innerWidth, H = window.innerHeight, cw = Math.min(340, W - 32);
  let pos = { left: W / 2 - cw / 2, top: H / 2 - 90 };
  if (rect) {
    if (rect.x + rect.w < 320 && rect.h < 120) pos = { left: rect.x + rect.w + 16, top: clamp(rect.y - 20, 16, H - 220) };
    else if (rect.y + rect.h + 210 < H) pos = { left: clamp(rect.x, 16, W - cw - 16), top: rect.y + rect.h + 14 };
    else pos = { left: clamp(rect.x, 16, W - cw - 16), top: Math.max(16, rect.y - 200) };
    if (W <= 640 && rect.y > H - 120) pos = { left: 16, top: rect.y - 210 };
  }
  const clip = rect
    ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x}px ${rect.y}px, ${rect.x}px ${rect.y + rect.h}px, ${rect.x + rect.w}px ${rect.y + rect.h}px, ${rect.x + rect.w}px ${rect.y}px, ${rect.x}px ${rect.y}px)`
    : 'none';

  return (
    <motion.div className="fixed inset-0 z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(2,6,14,0.62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', clipPath: clip, WebkitClipPath: clip }} onClick={onSkip} />
      {rect && (
        <motion.div className="absolute rounded-xl pointer-events-none" animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ border: '2px solid var(--energy-cyan)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--energy-cyan) 20%, transparent), var(--glow-blue)' }} />
      )}
      <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute rounded-xl p-5"
        style={{ ...pos, width: cw, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-pop)' }}>
        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--energy-cyan)' }}>Step {step + 1} of 3</div>
        <div className="text-base font-semibold mt-1.5">{TOUR[step].title}</div>
        <div className="text-sm text-ink-2 mt-1.5 leading-relaxed">{TOUR[step].body}</div>
        <div className="flex items-center mt-4">
          <div className="flex gap-1.5">{TOUR.map((_, i) => <span key={i} className="w-2 h-2 rounded-full transition-colors" style={{ background: i <= step ? 'var(--energy-cyan)' : 'var(--surface-3)' }} />)}</div>
          <div className="flex-1" />
          <button className="btn" style={{ height: 30, border: 'none', background: 'transparent' }} onClick={onSkip}>Skip</button>
          <button className="btn btn-primary" style={{ height: 30 }} onClick={onNext}>{step === TOUR.length - 1 ? 'Get started' : 'Next'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
export const TOUR_STEPS = TOUR.length;

export function Modal({ onClose, children, title }) {
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(2,6,14,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-xl p-6" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-pop)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">{title}</div>
          <button className="text-ink-3 hover:text-ink-1" onClick={onClose} aria-label="Close"><Icon name="X" size={16} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Toasts({ toasts }) {
  const pal = usePal();
  return (
    <div className="fixed z-[85] right-4 bottom-[70px] sm:bottom-6 flex flex-col gap-2 items-end pointer-events-none" style={{ maxWidth: 'calc(100vw - 32px)' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} layout initial={{ opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm pointer-events-auto border border-line-strong"
            style={{ background: 'var(--surface-2)', boxShadow: 'var(--shadow-pop)', borderLeftWidth: 3, borderLeftColor: pal[t.tone] || pal.green }}>
            <Icon name={t.tone === 'red' ? 'CircleAlert' : t.tone === 'blue' ? 'Info' : 'CircleCheck'} size={16} style={{ color: pal[t.tone] || pal.green }} />
            <span>{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
