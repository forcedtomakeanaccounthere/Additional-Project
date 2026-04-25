import { NavLink } from 'react-router-dom';
import { BellRing, CloudSun, Droplets, GaugeCircle, Trees, Wrench } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: GaugeCircle, end: true },
  { to: '/weather-conditions', label: 'Weather Conditions', icon: CloudSun },
  { to: '/environment', label: 'Environment', icon: Trees },
  { to: '/operations', label: 'Operations', icon: Wrench },
  { to: '/alerts', label: 'Alerts', icon: BellRing },
];

export function ShellLayout({ children, generatedAt, onRefresh, refreshing }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon-wrap">
            <Droplets className="brand-icon" size={24} />
          </div>
          <div>
            <p className="brand-title">Additional Project</p>
            <p className="brand-subtitle">Groundwater Level Analysis</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Dashboard Sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'nav-item-active' : ''}`
                }
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className="label">Last Snapshot</p>
          <p className="timestamp">{generatedAt ? new Date(generatedAt).toLocaleString() : 'Not available'}</p>
          <button type="button" className="refresh-btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Force Refresh'}
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
