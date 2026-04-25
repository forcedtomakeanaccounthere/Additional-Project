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
  const grid = environmental.saturationGrid || [];
  const regional = environmental.regionalForecast || [];
  const values = grid.map((cell) => Number(cell.saturation || 0));
  const minSat = values.length > 0 ? Math.min(...values) : 0;
  const maxSat = values.length > 0 ? Math.max(...values) : 1;
  const satRange = Math.max(0.0001, maxSat - minSat);

  return (
    <section className="page-grid">
      <header className="page-header single-column">
        <div>
          <p className="eyebrow">Environmental Signals</p>
          <h1>Rainfall and Aquifer Dynamics</h1>
          <p className="lead-text">
            Cross-view between precipitation forcing and groundwater response, with spatially inspired saturation mapping.
          </p>
        </div>
      </header>

      <section className="panel two-col-span">
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

      <section className="panel">
        <div className="panel-header">
          <h2>Saturation Matrix</h2>
          <p>Higher values indicate increased saturation pressure.</p>
        </div>
        <div className="heat-grid" role="img" aria-label="Saturation matrix heat grid">
          {grid.map((cell, index) => {
            const normalized = (Number(cell.saturation || 0) - minSat) / satRange;
            const hue = 198 - normalized * 150;
            const lightness = 90 - normalized * 45;
            const saturation = 58 + normalized * 22;
            const tone = `hsl(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`;
            const textColor = normalized > 0.55 ? '#f8fdff' : '#0f3b52';
            return (
              <div key={index} className="heat-cell" style={{ background: tone, color: textColor }}>
                {cell.saturation}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
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
  );
}
