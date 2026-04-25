import { useState, useEffect } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { MetricCard } from '../components/MetricCard';
import { fetchWaterLevel } from '../api/dashboardApi';

function levelStatus(value, threshold) {
  if (value >= threshold) return 'critical';
  if (value >= threshold * 0.9) return 'warning';
  return 'normal';
}

export function OverviewPage({ snapshot, summary, horizon, setHorizon, onLoad }) {
  const threshold = summary.threshold;
  const status = levelStatus(summary.max, threshold);
  const weeklyData = (snapshot.overview?.weeklyDistribution || []).map((item) => ({
    ...item,
    value: Number(item.value || 0),
  }));

  const [historicalData, setHistoricalData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchWaterLevel().then((csv) => {
      const lines = csv.trim().split('\n');
      if (lines.length > 1) {
        const data = lines.slice(1).map(line => {
          const [serial, dateStr, timeStr, device, percent] = line.split(',');
          // dateStr is DD/MM/YYYY, transform to YYYY-MM-DD for easy parsing
          const [day, month, year] = dateStr.split('/');
          const isoDate = `${year}-${month}-${day}`;
          return {
            dateStr: isoDate,
            timeStr,
            datetime: new Date(`${isoDate}T${timeStr}`),
            level: Number(percent)
          };
        });
        setHistoricalData(data);
      }
    }).catch(err => console.error("Could not fetch water level history", err));
  }, []);

  const filteredHistory = historicalData.filter(d => {
    if (startDate && d.dateStr < startDate) return false;
    if (endDate && d.dateStr > endDate) return false;
    return true;
  });

  // Decide format based on duration
  let formattedHistory = [];
  if (filteredHistory.length > 0) {
    const timeDiff = filteredHistory[filteredHistory.length - 1].datetime - filteredHistory[0].datetime;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // Group by day if > 48h, else show time
    if (hoursDiff > 48) {
      const byDay = {};
      filteredHistory.forEach(d => {
        if (!byDay[d.dateStr]) byDay[d.dateStr] = [];
        byDay[d.dateStr].push(d.level);
      });
      formattedHistory = Object.keys(byDay).map(dateStr => ({
        label: dateStr,
        level: byDay[dateStr].reduce((a, b) => a + b, 0) / byDay[dateStr].length
      }));
    } else {
      formattedHistory = filteredHistory.map(d => ({
        label: `${d.dateStr} ${d.timeStr}`,
        level: d.level
      }));
    }
  }

  return (
    <section className="page-grid">
      <header className="page-header">
        <div>
          <p className="eyebrow">Hydraulic Risk Overview</p>
          <h1>Reservoir Monitoring Dashboard</h1>
          <p className="lead-text">
            Live tank level, forecast envelope, and pump strategy based on your notebook-trained prediction artifacts.
          </p>
        </div>

        <div className="controls">
          <label htmlFor="horizon">Horizon</label>
          <select
            id="horizon"
            value={horizon}
            onChange={(event) => setHorizon(Number(event.target.value))}
          >
            <option value={12}>12h</option>
            <option value={24}>24h</option>
            <option value={36}>36h</option>
            <option value={48}>48h</option>
          </select>
          <button type="button" onClick={() => onLoad(horizon, true)}>Apply</button>
        </div>
      </header>

      <section className="metrics-row">
        <MetricCard
          label="Live Tank Level"
          value={`${summary.live.toFixed(1)}%`}
          hint="Current observed water level"
          status={summary.live >= threshold ? 'critical' : 'normal'}
        />
        <MetricCard
          label="Max Forecast Level"
          value={`${summary.max.toFixed(1)}%`}
          hint={`Threshold: ${threshold}%`}
          status={status}
        />
        <MetricCard
          label="Recommended Pumps"
          value={`${summary.pumps} / 2`}
          hint="Automated operational suggestion"
          status={summary.pumps === 0 ? 'normal' : 'warning'}
        />
        <MetricCard
          label="Threshold Utilization"
          value={`${summary.utilization.toFixed(1)}%`}
          hint="Current level against configured threshold"
          status={summary.utilization > 95 ? 'critical' : summary.utilization > 80 ? 'warning' : 'normal'}
        />
      </section>

      <section className="panel two-col-span">
        <div className="panel-header">
          <h2>Predicted Tank Level</h2>
          <p>Forward profile generated from the current state and weather trajectory.</p>
        </div>
        <div className="chart-wrap large-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snapshot.overview?.forecastSeries || []}>
              <defs>
                <linearGradient id="waterLevelGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2b9ccc" stopOpacity={0.72} />
                  <stop offset="45%" stopColor="#1f88b8" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#1f88b8" stopOpacity={0.09} />
                </linearGradient>

                <pattern id="waterRipplePattern" x="0" y="0" width="180" height="46" patternUnits="userSpaceOnUse">
                  <path
                    d="M 0 28 C 15 20, 30 20, 45 28 C 60 36, 75 36, 90 28 C 105 20, 120 20, 135 28 C 150 36, 165 36, 180 28"
                    fill="none"
                    stroke="rgba(225, 247, 255, 0.54)"
                    strokeWidth="2"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values="0 0; -45 0; -90 0; -45 0; 0 0"
                      dur="7.4s"
                      repeatCount="indefinite"
                    />
                  </path>

                  <path
                    d="M 0 14 C 16 8, 32 8, 48 14 C 64 20, 80 20, 96 14 C 112 8, 128 8, 144 14 C 160 20, 176 20, 192 14"
                    fill="none"
                    stroke="rgba(196, 239, 255, 0.34)"
                    strokeWidth="1.6"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values="0 0; 38 -1; 62 1; 22 -2; 0 0"
                      dur="10.6s"
                      repeatCount="indefinite"
                    />
                  </path>

                  <circle cx="26" cy="36" r="1.9" fill="rgba(233, 250, 255, 0.35)">
                    <animate attributeName="cx" values="26;45;34;52;26" dur="8.8s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="36;26;34;24;36" dur="8.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.05;0.36;0.15;0.32;0.05" dur="8.8s" repeatCount="indefinite" />
                  </circle>
                </pattern>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 46, 71, 0.12)" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={28} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="level"
                stroke="#0a5972"
                strokeWidth={3}
                dot={false}
                fill="url(#waterLevelGradient)"
                fillOpacity={1}
                name="Predicted level (%)"
              />
              <Area
                type="monotone"
                dataKey="level"
                stroke="none"
                dot={false}
                activeDot={false}
                fill="url(#waterRipplePattern)"
                fillOpacity={0.95}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Weekly Rain Distribution</h2>
          <p>Total rainfall in the rolling weekly window.</p>
        </div>
        <div className="chart-wrap small-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 46, 71, 0.12)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} mm`, 'Rainfall']} />
              <Bar dataKey="value" fill="#3c8d68" radius={[8, 8, 0, 0]} name="Rain (mm)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Operational Notes</h2>
          <p>Auto-generated recommendations from the forecast engine.</p>
        </div>
        <ul className="notes-list">
          <li>Keep pump manifold standby if max forecast remains below threshold.</li>
          <li>Escalate to two-pump mode only when severe overflow risk persists.</li>
          <li>Review sensor calibration daily for confidence in sudden drop events.</li>
        </ul>
      </section>
    </section>
  );
}
