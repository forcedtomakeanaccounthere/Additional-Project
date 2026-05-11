import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function EnvironmentPage({ snapshot }) {
  const environmental = snapshot.environmental || {};
  const points = environmental.precipitationVsGroundwater || [];
  const regional = environmental.regionalForecast || [];

  return (
    <section className="page-grid">
      <header className="page-header single-column">
        <div>
          <p className="eyebrow">Environmental Signals</p>
          <h1>Rainfall and Aquifer Dynamics</h1>
          <p className="lead-text">
            Cross-view between precipitation forcing and groundwater response, plus the regional rainfall outlook.
          </p>
        </div>
      </header>

      <section className="env-split">
        <section className="panel env-main">
          <div className="panel-header">
            <h2>Precipitation vs Groundwater</h2>
            <p>Recent trend of rainfall pulses against tank level response.</p>
          </div>
          <div className="chart-wrap large-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points}>
                <defs>
                  <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1f7a8c" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#1f7a8c" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="groundFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2e9466" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#2e9466" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 46, 71, 0.12)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area yAxisId="right" type="monotone" dataKey="rain" stroke="#1f7a8c" fill="url(#rainFill)" name="Rainfall" />
                <Area yAxisId="left" type="monotone" dataKey="groundwater" stroke="#2e9466" fill="url(#groundFill)" name="Groundwater Level" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel env-side">
          <div className="panel-header">
            <h2>Regional Forecast</h2>
            <p>Predicted rainfall totals over coming days.</p>
          </div>
          <div className="mini-stat-list">
            {regional.length > 0 ? regional.map((item) => (
              <article key={item.day} className="mini-stat">
                <p className="mini-stat-label">{item.day}</p>
                <p className="mini-stat-value">{Number(item.rainfall || 0).toFixed(1)} mm</p>
              </article>
            )) : (
              <article className="mini-stat">
                <p className="mini-stat-label">No forecast</p>
                <p className="mini-stat-value">Waiting for weather feed</p>
              </article>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}
