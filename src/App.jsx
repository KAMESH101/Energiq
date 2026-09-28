import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { lsGet, lsSet } from './lib/format.js';
import { ZONES } from './lib/campus.js';
import { computeModel } from './lib/model.js';
import { withLive } from './lib/live.js';
import { buildRecs } from './lib/recommendations.js';
import { buildReport, downloadText, printHTML } from './lib/report.js';
import ExportDialog from './components/ExportDialog.jsx';
import { PalCtx, readPalette } from './lib/theme.js';
import { useSimulation } from './hooks/useSimulation.js';
import { useAlertEngine } from './hooks/useAlertEngine.js';
import TopBar from './components/TopBar.jsx';
import { NAV, Sidebar, BottomNav } from './components/Nav.jsx';
import { Tour, TOUR_STEPS, Modal, Toasts } from './components/Overlays.jsx';
import Overview from './views/Overview.jsx';
import Zones from './views/Zones.jsx';
import Forecast from './views/Forecast.jsx';
import Savings from './views/Savings.jsx';
import Alerts from './views/Alerts.jsx';

const TITLES = {
  overview: ['Overview', 'Campus-wide energy at a glance'],
  zones: ['Zone Monitor', 'Drill into each building zone'],
  forecast: ['Forecast & Predictions', 'What the next 24 hours look like'],
  savings: ['Savings Recommendations', 'Actionable schedules with measurable impact'],
  alerts: ['Alerts & Monitoring', 'Threshold breaches, idle draw and anomalies'],
};
const SHORTCUTS = [['1 – 5', 'Switch view'], ['Space', 'Pause / resume live updates'], ['D', 'Toggle dark / light theme'], ['F', 'Toggle fullscreen'], ['E', 'Export report'], ['?', 'Show this panel'], ['Esc', 'Close overlays']];
const DEFAULT_THRESHOLDS = Object.fromEntries(ZONES.map(z => [z.id, { warn: 85, crit: 95, warnOn: true, critOn: true, idleOn: z.id !== 'server' }]));

export default function App() {
  /* Theme */
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [pal, setPal] = useState(() => readPalette());
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    setPal(readPalette());
    lsSet('energiq-theme', theme);
  }, [theme]);
  const toggleTheme = useCallback(() => {
    const el = document.documentElement;
    el.classList.add('theme-anim');
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
    setTimeout(() => el.classList.remove('theme-anim'), 350);
  }, []);

  /* Navigation */
  const [view, setViewRaw] = useState('overview');
  const setView = useCallback(v => { setViewRaw(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);
  const [zoneSel, setZoneSel] = useState('admin');

  /* Simulation, model & engines */
  const { abs, time, playing, setPlaying } = useSimulation();
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [customRules, setCustomRules] = useState([]);
  const baseModel = useMemo(() => computeModel(abs), [abs]);
  const model = useMemo(() => withLive(baseModel, time.getTime()), [baseModel, time]);
  const { alerts, acknowledge } = useAlertEngine(model, thresholds, customRules);
  const recs = useMemo(() => buildRecs(baseModel), [baseModel]);
  const [applied, setApplied] = useState(['lighting-motion', 'server-cooling']);
  const [handled, setHandled] = useState([]);

  /* Toasts */
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, tone = 'green') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t.slice(-3), { id, msg, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  /* Bell pulse when the active-alert count rises */
  const activeCount = alerts.filter(a => a.status === 'active' && a.sev !== 'info').length;
  const prevCount = useRef(activeCount);
  const [bellKey, setBellKey] = useState(0);
  useEffect(() => {
    if (activeCount > prevCount.current) setBellKey(k => k + 1);
    prevCount.current = activeCount;
  }, [activeCount]);

  /* Pop a toast the moment the live check raises a new alert */
  const lastSeen = useRef(alerts[0]?.id ?? 0);
  useEffect(() => {
    const fresh = alerts.filter(a => a.id > lastSeen.current && a.live && a.sev !== 'info');
    if (alerts.length) lastSeen.current = Math.max(lastSeen.current, alerts[0].id);
    fresh.slice(0, 2).forEach(a => toast(`${a.zone}: ${a.title}`, a.sev === 'critical' ? 'red' : 'amber'));
  }, [alerts, toast]);

  /* Boot screen hand-off + first-visit tour */
  const [showKeys, setShowKeys] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [tourStep, setTourStep] = useState(null);
  useEffect(() => {
    window.__finishBoot?.();
    const start = () => { if (!lsGet('energiq-tour-done')) setTimeout(() => { setViewRaw('overview'); setTourStep(0); }, 500); };
    if (window.__booted) start(); else window.addEventListener('energiq:booted', start, { once: true });
    return () => window.removeEventListener('energiq:booted', start);
  }, []);
  const endTour = useCallback(() => { setTourStep(null); lsSet('energiq-tour-done', '1'); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  /* Actions */
  const doExport = useCallback(opts => {
    const { text, name, type, format } = buildReport(model, alerts, recs, applied, opts);
    if (format === 'pdf') { printHTML(text); toast('Report ready — choose "Save as PDF" in the print dialog'); }
    else { downloadText(text, name, type); toast(`Report exported — ${name}`); }
    setShowExport(false);
  }, [model, alerts, recs, applied, toast]);

  const toggleFull = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => toast('Fullscreen not available in this context', 'blue'));
    else document.exitFullscreen?.();
  }, [toast]);

  const applyRec = r => { setApplied(a => (a.includes(r.id) ? a : [...a, r.id])); toast(r.toast); };
  const undoRec = r => { setApplied(a => a.filter(x => x !== r.id)); toast(`Reverted — ${r.title}`, 'blue'); };
  const handlePeak = p => { setHandled(h => [...h, p.key]); toast(`${p.zone.name}: ${p.action}`); };
  const ack = a => { acknowledge(a); toast(`Acknowledged — ${a.zone}: ${a.title}`, 'blue'); };
  const openZone = id => { setZoneSel(id); setView('zones'); };

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setShowKeys(false); setShowExport(false); if (tourStep !== null) endTour(); return; }
      if (tourStep !== null) return;
      if (e.key >= '1' && e.key <= '5') setView(NAV[+e.key - 1].id);
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'd' || e.key === 'D') toggleTheme();
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else if (e.key === 'e' || e.key === 'E') setShowExport(true);
      else if (e.key === '?') setShowKeys(s => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourStep, endTour, toggleTheme, toggleFull, setView, setPlaying]);

  let content;
  if (view === 'overview') content = <Overview model={model} alerts={alerts} recs={recs} applied={applied} thresholds={thresholds} onZone={openZone} onGoto={setView} />;
  else if (view === 'zones') content = <Zones model={model} zoneSel={zoneSel} setZoneSel={setZoneSel} thresholds={thresholds} />;
  else if (view === 'forecast') content = <Forecast model={model} thresholds={thresholds} handled={handled} onHandle={handlePeak} />;
  else if (view === 'savings') content = <Savings model={model} recs={recs} applied={applied} onApply={applyRec} onUndo={undoRec} />;
  else content = <Alerts alerts={alerts} model={model} onAck={ack} thresholds={thresholds} setThresholds={setThresholds} customRules={customRules} setCustomRules={setCustomRules} toast={toast} />;

  return (
    <PalCtx.Provider value={pal}>
      <TopBar abs={abs} time={time} playing={playing} onPlay={() => setPlaying(p => !p)} theme={theme} onTheme={toggleTheme} model={model}
        alertCount={activeCount} bellKey={bellKey} onBell={() => setView('alerts')} onExport={() => setShowExport(true)} onHelp={() => setShowKeys(true)} />
      <Sidebar view={view} setView={setView} alertCount={activeCount} acc={model.acc} nextReadingSec={model.nextReadingSec} />
      <BottomNav view={view} setView={setView} alertCount={activeCount} />

      <main className="main">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-5">
          <div>
            <h1 className="font-bold tracking-tight" style={{ fontSize: 'clamp(1.35rem, 2.2vw, 1.75rem)' }}>{TITLES[view][0]}</h1>
            <div className="text-sm text-ink-2 mt-0.5">{TITLES[view][1]} · VIT Smart Campus</div>
          </div>
          <div className="text-xs text-ink-3 mono hide-sm">Press <kbd>?</kbd> for shortcuts</div>
        </div>
        <div className="flex-1">
          {/* Keyed wrapper remounts per view: the new view mounts instantly and fades in (no blocking exit phase) */}
          <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {content}
          </motion.div>
        </div>
        <footer className="mt-10 pt-5 border-t border-line-subtle text-center text-xs text-ink-3">Built for TeachPulse Hackathon 2026 • EnergiQ by Void • VIT Chennai</footer>
      </main>

      <AnimatePresence>
        {showExport && (
          <Modal key="export" wide title="Export report" onClose={() => setShowExport(false)}>
            <ExportDialog model={model} alerts={alerts} recs={recs} applied={applied} onExport={doExport} />
          </Modal>
        )}
        {showKeys && (
          <Modal key="keys" title="Keyboard shortcuts" onClose={() => setShowKeys(false)}>
            <div className="flex flex-col gap-2.5 text-sm">
              {SHORTCUTS.map(([k, v]) => <div key={k} className="flex items-center justify-between"><span className="text-ink-2">{v}</span><kbd>{k}</kbd></div>)}
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tourStep !== null && <Tour key="tour" step={tourStep} onNext={() => (tourStep >= TOUR_STEPS - 1 ? endTour() : setTourStep(s => s + 1))} onSkip={endTour} />}
      </AnimatePresence>
      <Toasts toasts={toasts} />
    </PalCtx.Provider>
  );
}
