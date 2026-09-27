import { fkW, fINR } from '../lib/format.js';
import { hhmm, dateOf } from '../lib/campus.js';
import { usePal, loadColor } from '../lib/theme.js';
import { Icon, CountUp, Seg } from './ui.jsx';

export default function TopBar({ abs, playing, onPlay, speed, setSpeed, theme, onTheme, model, alertCount, bellKey, onBell, onExport, onHelp }) {
  const pal = usePal(), dt = dateOf(abs);
  return (
    <header className={`topbar flex items-center gap-3 sm:gap-5 px-3 sm:px-5 ${playing ? '' : 'paused'}`}>
      <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight flex-shrink-0">
        <Icon name="Zap" size={22} style={{ color: pal.cyan, filter: `drop-shadow(0 0 8px ${pal.cyan})` }} fill={pal.cyan} />
        <span>Energi<span style={{ color: pal.cyan }}>Q</span></span>
      </div>
      <div className="h-8 w-px bg-line-subtle hidden sm:block" />

      <div className="flex items-center gap-2.5 min-w-0">
        <span className="live-dot" />
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: playing ? pal.cyan : pal.t3 }}>{playing ? 'Live' : 'Paused'}</span>
            <span className="mono text-sm font-semibold whitespace-nowrap">{hhmm(abs)}:00<span className="text-ink-3 text-xs hide-sm"> IST</span></span>
          </div>
          <div className="text-[11px] text-ink-3 hide-sm">{dt.wd}, {dt.label}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-icon" onClick={onPlay} title={playing ? 'Pause (Space)' : 'Resume (Space)'} aria-label={playing ? 'Pause simulation' : 'Resume simulation'}>
          <Icon name={playing ? 'Pause' : 'Play'} size={15} />
        </button>
        <div className="hide-sm"><Seg id="speed" value={speed} onChange={setSpeed} options={[{ value: 1, label: '1x' }, { value: 2, label: '2x' }, { value: 4, label: '4x' }]} /></div>
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-5 mr-1">
        <div className="text-right leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Campus load</div>
          <div className="text-lg font-bold" style={{ color: loadColor(pal, model.pct) }}><CountUp value={model.cur} format={fkW} /></div>
        </div>
        <div className="text-right leading-tight hide-md">
          <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Cost today</div>
          <div className="text-lg font-bold"><CountUp value={model.costToday} format={fINR} /></div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button className="btn hide-sm" onClick={onExport} title="Export daily report (.md)"><Icon name="Download" size={15} /><span className="hide-lg">Export Report</span></button>
        <button className="btn btn-icon hide-sm" onClick={onHelp} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts"><Icon name="Keyboard" size={15} /></button>
        <button className="btn btn-icon" onClick={onTheme} title="Toggle theme (D)" aria-label="Toggle theme"><Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={15} /></button>
        <button className="btn btn-icon relative" onClick={onBell} title="Active alerts" aria-label={`${alertCount} active alerts`}>
          <span key={bellKey} className={bellKey ? 'bell-pulse inline-flex' : 'inline-flex'}><Icon name="Bell" size={15} /></span>
          {alertCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center mono"
              style={{ background: pal.red, color: '#fff', boxShadow: `0 0 10px ${pal.red}` }}>{alertCount > 99 ? '99+' : alertCount}</span>
          )}
        </button>
      </div>
    </header>
  );
}
