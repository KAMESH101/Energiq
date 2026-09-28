import { fPct, fmtCountdown } from '../lib/format.js';
import { usePal } from '../lib/theme.js';
import { Icon } from './ui.jsx';

export const NAV = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'zones', label: 'Zones', icon: 'Building2' },
  { id: 'forecast', label: 'Forecast', icon: 'TrendingUp' },
  { id: 'savings', label: 'Savings', icon: 'Lightbulb' },
  { id: 'alerts', label: 'Alerts', icon: 'Bell' },
];

export function Sidebar({ view, setView, alertCount, acc, nextReadingSec }) {
  const pal = usePal();
  const sys = [
    ['Grid', <span className="inline-flex items-center gap-1.5" style={{ color: pal.green }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: pal.green, boxShadow: `0 0 6px ${pal.green}` }} />OK</span>],
    ['Uptime', <span className="mono">99.9%</span>],
    ['Zones', <span className="mono">6/6 online</span>],
    ['Model', <span className="mono" style={{ color: pal.purple }}>WMA-12</span>],
    ['MAPE', <span className="mono" style={{ color: acc.mape < 5 ? pal.green : pal.amber }}>{fPct(acc.mape)}</span>],
    ['Next reading', <span className="mono" style={{ color: pal.cyan }}>{fmtCountdown(nextReadingSec)}</span>],
  ];
  return (
    <aside className="sidebar">
      <nav className="flex flex-col gap-1">
        {NAV.map((n, i) => (
          <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)} data-tip={n.label}
            data-tour={n.id === 'savings' ? 'nav-savings' : undefined}>
            <Icon name={n.icon} size={18} />
            <span className="nav-label">{n.label}</span>
            {n.id === 'alerts' && alertCount > 0
              ? <span className="nav-badge">{alertCount}</span>
              : <span className="nav-label ml-auto text-[11px] text-ink-3 mono">{i + 1}</span>}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="sys-block border-t border-line-subtle pt-4 px-2">
        <div className="card-title mb-3" style={{ fontSize: 11 }}>System</div>
        {sys.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-xs py-1"><span className="text-ink-3">{k}</span><span className="text-ink-2 font-medium">{v}</span></div>
        ))}
        <div className="text-[10px] text-ink-3 mt-3 leading-relaxed">VIT Smart Campus · 37,500 sq ft<br />15-min interval metering</div>
      </div>
    </aside>
  );
}

export function BottomNav({ view, setView, alertCount }) {
  const pal = usePal();
  return (
    <nav className="bottombar">
      {NAV.map(n => (
        <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => setView(n.id)} data-tour={n.id === 'savings' ? 'nav-savings' : undefined}>
          <Icon name={n.icon} size={19} />
          <span>{n.label}</span>
          {n.id === 'alerts' && alertCount > 0 && <span className="absolute top-1.5 right-[calc(50%-18px)] w-2 h-2 rounded-full" style={{ background: pal.red }} />}
        </button>
      ))}
    </nav>
  );
}
