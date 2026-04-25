import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { MetricCard } from '../components/MetricCard';
import { fetchWeatherConditions } from '../api/dashboardApi';

const RANGE_OPTIONS = [
  { label: 'Hourly', value: 'hourly' },
  { label: 'Daily', value: 'daily' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const EMPTY_RESPONSE = {
  latest: {
    temperatureC: 0,
    humidity: 0,
    pressureMb: 0,
    dewpointC: 0,
    rainRateMmPerHr: 0,
    rainDayMm: 0,
  },
  summary: {
    avgTemperatureC: 0,
    minTemperatureC: 0,
    maxTemperatureC: 0,
    avgHumidity: 0,
    avgPressureMb: 0,
    avgRainRateMmPerHr: 0,
    dataPoints: 0,
  },
  series: [],
};

export function WeatherConditionsPage() {
  const [range, setRange] = useState('hourly');
  const [selectedRange, setSelectedRange] = useState('hourly');
  const [payload, setPayload] = useState(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetchWeatherConditions(selectedRange);
        if (!active) return;
        setPayload({
          latest: response.latest || EMPTY_RESPONSE.latest,
          summary: response.summary || EMPTY_RESPONSE.summary,
          series: response.series || [],
        });
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || err.message || 'Failed to fetch weather conditions.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [selectedRange]);

  const chartData = useMemo(
    () => (payload.series || []).map((item) => ({
      ...item,
      tempC: Number(item.tempC || 0),
      humidity: Number(item.humidity || 0),
      pressureMb: Number(item.pressureMb || 0),
      rainRateMmPerHr: Number(item.rainRateMmPerHr || 0),
    })),
    [payload.series],
  );

  return (
    <section className="page-grid">
      <header className="page-header">
        <div>
          <p className="eyebrow">Weather Conditions</p>
          <h1>Davisport Weather Features</h1>
          <p className="lead-text">
            Key weather signals used by the prediction model, aggregated across hourly, daily, monthly, and yearly ranges.
          </p>
        </div>

        <div className="controls">
          <label htmlFor="weather-range">Range</label>
          <select
            id="weather-range"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => setSelectedRange(range)} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </header>

      {error ? <p className="banner banner-error two-col-span">{error}</p> : null}

      <section className="metrics-row two-col-span">
        <MetricCard
          label="Current Temperature"
          value={`${Number(payload.latest.temperatureC || 0).toFixed(1)}°C`}
          hint="Latest Davisport reading"
          status="normal"
        />
        <MetricCard
          label="Current Humidity"
          value={`${Number(payload.latest.humidity || 0).toFixed(1)}%`}
          hint="Relative humidity"
          status={Number(payload.latest.humidity || 0) > 80 ? 'warning' : 'normal'}
        />
        <MetricCard
          label="Current Pressure"
          value={`${Number(payload.latest.pressureMb || 0).toFixed(1)} mb`}
          hint="Surface pressure"
          status="normal"
        />
        <MetricCard
          label="Rainfall Rate"
          value={`${Number(payload.latest.rainRateMmPerHr || 0).toFixed(2)} mm/h`}
          hint="Current precipitation intensity"
          status={Number(payload.latest.rainRateMmPerHr || 0) > 5 ? 'warning' : 'normal'}
        />
      </section>

      <section className="panel two-col-span">
        <div className="panel-header">
          <h2>Model-Input Weather Trends</h2>
          <p>Temperature, humidity, and pressure trends across the selected aggregation range.</p>
        </div>
        <div className="chart-wrap large-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 46, 71, 0.12)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="tempC" name="Temperature (°C)" stroke="#1f7a8c" dot={false} strokeWidth={2.5} />
              <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#2e9466" dot={false} strokeWidth={2.2} />
              <Line yAxisId="right" type="monotone" dataKey="pressureMb" name="Pressure (mb)" stroke="#b46a16" dot={false} strokeWidth={2.2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Range Summary</h2>
          <p>Averages and extrema computed over the selected period.</p>
        </div>
        <div className="mini-stat-list">
          <article className="mini-stat">
            <p className="mini-stat-label">Average Temperature</p>
            <p className="mini-stat-value">{Number(payload.summary.avgTemperatureC || 0).toFixed(2)}°C</p>
          </article>
          <article className="mini-stat">
            <p className="mini-stat-label">Min / Max Temperature</p>
            <p className="mini-stat-value">
              {Number(payload.summary.minTemperatureC || 0).toFixed(2)} / {Number(payload.summary.maxTemperatureC || 0).toFixed(2)}°C
            </p>
          </article>
          <article className="mini-stat">
            <p className="mini-stat-label">Average Humidity</p>
            <p className="mini-stat-value">{Number(payload.summary.avgHumidity || 0).toFixed(2)}%</p>
          </article>
          <article className="mini-stat">
            <p className="mini-stat-label">Average Pressure</p>
            <p className="mini-stat-value">{Number(payload.summary.avgPressureMb || 0).toFixed(2)} mb</p>
          </article>
          <article className="mini-stat">
            <p className="mini-stat-label">Average Rain Rate</p>
            <p className="mini-stat-value">{Number(payload.summary.avgRainRateMmPerHr || 0).toFixed(3)} mm/h</p>
          </article>
          <article className="mini-stat">
            <p className="mini-stat-label">Samples in View</p>
            <p className="mini-stat-value">{Number(payload.summary.dataPoints || 0)}</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Recent Range Samples</h2>
          <p>Last observations in the selected aggregation.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Temp (°C)</th>
                <th>Humidity (%)</th>
                <th>Pressure (mb)</th>
                <th>Rain (mm/h)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.slice(-10).map((row) => (
                <tr key={`${row.timestamp}-${row.label}`}>
                  <td>{row.label}</td>
                  <td>{Number(row.tempC || 0).toFixed(2)}</td>
                  <td>{Number(row.humidity || 0).toFixed(2)}</td>
                  <td>{Number(row.pressureMb || 0).toFixed(2)}</td>
                  <td>{Number(row.rainRateMmPerHr || 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
