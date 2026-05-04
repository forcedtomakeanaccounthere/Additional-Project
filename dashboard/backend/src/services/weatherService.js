const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csvWriter = require('csv-write-stream');

const DAVIS_API_URL = "https://api.weatherlink.com/v1/NoaaExt.json?user=001D0AE0D9F1&pass=Bheem@9986&apiToken=FB6A9D3466F14A2F9CDB1A04911E4202";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const CSV_FILE = path.join(__dirname, '..', '..', 'data', 'actual_weather_data.csv');
const OBSERVATIONS_CSV_FILE = path.join(__dirname, '..', '..', 'data', 'weather_observations.csv');
let latestWeatherData = null;

function readCsvRows(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) return [];

  const lines = content.split('\n');
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').trim();
    });
    return row;
  });
}

function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [day, month, year] = String(dateStr).split('/');
  if (!day || !month || !year) return null;

  const dt = new Date(`${year}-${month}-${day}T${String(timeStr).slice(0, 8)}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRange(range) {
  const value = String(range || 'hourly').toLowerCase();
  if (['hourly', 'daily', 'monthly', 'yearly'].includes(value)) {
    return value;
  }
  return 'hourly';
}

function groupRowsForRange(rows, range) {
  const now = Date.now();
  const buckets = new Map();

  rows.forEach((row) => {
    const date = parseDateTime(row.Date, row.Time);
    if (!date) return;

    let key = '';
    let label = '';
    const ageMs = now - date.getTime();

    if (range === 'hourly') {
      if (ageMs > 24 * 60 * 60 * 1000) return;
      key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
      label = `${String(date.getHours()).padStart(2, '0')}:00`;
    }

    if (range === 'daily') {
      if (ageMs > 30 * 24 * 60 * 60 * 1000) return;
      key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (range === 'monthly') {
      if (ageMs > 366 * 24 * 60 * 60 * 1000) return;
      key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      label = date.toLocaleString('en-US', { month: 'short' });
    }

    if (range === 'yearly') {
      key = `${date.getFullYear()}`;
      label = `${date.getFullYear()}`;
    }

    if (!buckets.has(key)) {
      buckets.set(key, {
        label,
        timestamp: date.toISOString(),
        tempTotal: 0,
        humidityTotal: 0,
        pressureTotal: 0,
        rainRateTotal: 0,
        rainDayMax: 0,
        count: 0,
      });
    }

    const bucket = buckets.get(key);
    bucket.tempTotal += toNumber(row.Temp_C);
    bucket.humidityTotal += toNumber(row.Humidity);
    bucket.pressureTotal += toNumber(row.Pressure_mb);
    bucket.rainRateTotal += toNumber(row.Rain_Rate_in_per_hr) * 25.4;
    bucket.rainDayMax = Math.max(bucket.rainDayMax, toNumber(row.Rain_Day_in) * 25.4);
    bucket.count += 1;

    if (date.toISOString() > bucket.timestamp) {
      bucket.timestamp = date.toISOString();
      bucket.label = label;
    }
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((bucket) => ({
      label: bucket.label,
      timestamp: bucket.timestamp,
      tempC: Number((bucket.tempTotal / Math.max(bucket.count, 1)).toFixed(2)),
      humidity: Number((bucket.humidityTotal / Math.max(bucket.count, 1)).toFixed(2)),
      pressureMb: Number((bucket.pressureTotal / Math.max(bucket.count, 1)).toFixed(2)),
      rainRateMmPerHr: Number((bucket.rainRateTotal / Math.max(bucket.count, 1)).toFixed(3)),
      rainDayMm: Number(bucket.rainDayMax.toFixed(3)),
      samples: bucket.count,
    }));
}

async function fetchWeather() {
  try {
    const response = await axios.get(DAVIS_API_URL);
    latestWeatherData = response.data;
    
    // Save to CSV
    storeInCSV(latestWeatherData);
    console.log('[WeatherService] Saved new weather data at', new Date().toISOString());
  } catch (err) {
    console.error('[WeatherService] Error fetching weather', err.message);
  }
}

function storeInCSV(data) {
  const d = new Date();
  const row = {
    Date: d.toLocaleDateString('en-GB'), // DD/MM/YYYY
    Time: d.toLocaleTimeString('en-GB'),
    Temp_C: data.temp_c || 0,
    Dewpoint_C: data.dewpoint_c || 0,
    Humidity: data.relative_humidity || 0,
    Pressure_mb: data.pressure_mb || 0,
    Rain_Rate_in_per_hr: data.davis_current_observation?.rain_rate_in_per_hr || 0,
    Rain_Day_in: data.davis_current_observation?.rain_day_in || 0
  };

  const dir = path.dirname(CSV_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const writer = csvWriter({ sendHeaders: !fs.existsSync(CSV_FILE) });
  writer.pipe(fs.createWriteStream(CSV_FILE, { flags: 'a' }));
  writer.write(row);
  writer.end();

  storeObservationCSV(data, d);
}

function storeObservationCSV(data, timestamp = new Date()) {
  const rainRateIn = toNumber(data.davis_current_observation?.rain_rate_in_per_hr || 0);
  const rainDayIn = toNumber(data.davis_current_observation?.rain_day_in || 0);
  const row = {
    timestamp: timestamp.toISOString(),
    temperature_c: toNumber(data.temp_c),
    humidity: toNumber(data.relative_humidity),
    pressure_mb: toNumber(data.pressure_mb),
    dewpoint_c: toNumber(data.dewpoint_c),
    heat_index_c: toNumber(data.heat_index_c || data.davis_current_observation?.heat_index_c),
    wind_mph: toNumber(data.davis_current_observation?.wind_mph),
    rain_rate_mm_per_hr: Number((rainRateIn * 25.4).toFixed(3)),
    rain_day_mm: Number((rainDayIn * 25.4).toFixed(3)),
    solar_radiation: toNumber(data.davis_current_observation?.solar_radiation),
    uv_index: toNumber(data.davis_current_observation?.uv_index),
    station_id: data.station_id || 'davis-station',
    station_name: data.station_name || 'Davis Weather Station',
  };

  const writer = csvWriter({ sendHeaders: !fs.existsSync(OBSERVATIONS_CSV_FILE) });
  writer.pipe(fs.createWriteStream(OBSERVATIONS_CSV_FILE, { flags: 'a' }));
  writer.write(row);
  writer.end();
}

function getLatestWeather() {
  return latestWeatherData;
}

function getHistoricalWeather() {
  return readCsvRows(CSV_FILE);
}

function getWeatherConditions(range = 'hourly') {
  const normalizedRange = normalizeRange(range);
  const rows = getHistoricalWeather();
  const series = groupRowsForRange(rows, normalizedRange);

  const latest = rows.length > 0 ? rows[rows.length - 1] : {};
  const tempValues = series.map((item) => item.tempC);
  const humidityValues = series.map((item) => item.humidity);
  const pressureValues = series.map((item) => item.pressureMb);
  const rainValues = series.map((item) => item.rainRateMmPerHr);

  const summary = {
    avgTemperatureC: Number((tempValues.reduce((sum, v) => sum + v, 0) / Math.max(tempValues.length, 1)).toFixed(2)),
    minTemperatureC: Number((tempValues.length ? Math.min(...tempValues) : 0).toFixed(2)),
    maxTemperatureC: Number((tempValues.length ? Math.max(...tempValues) : 0).toFixed(2)),
    avgHumidity: Number((humidityValues.reduce((sum, v) => sum + v, 0) / Math.max(humidityValues.length, 1)).toFixed(2)),
    avgPressureMb: Number((pressureValues.reduce((sum, v) => sum + v, 0) / Math.max(pressureValues.length, 1)).toFixed(2)),
    avgRainRateMmPerHr: Number((rainValues.reduce((sum, v) => sum + v, 0) / Math.max(rainValues.length, 1)).toFixed(3)),
    dataPoints: series.length,
  };

  return {
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    latest: {
      temperatureC: toNumber(latest.Temp_C),
      humidity: toNumber(latest.Humidity),
      pressureMb: toNumber(latest.Pressure_mb),
      dewpointC: toNumber(latest.Dewpoint_C),
      rainRateMmPerHr: Number((toNumber(latest.Rain_Rate_in_per_hr) * 25.4).toFixed(3)),
      rainDayMm: Number((toNumber(latest.Rain_Day_in) * 25.4).toFixed(3)),
    },
    summary,
    series,
  };
}

function startPolling() {
  fetchWeather(); // Initial fetch
  setInterval(fetchWeather, FIFTEEN_MINUTES_MS); // Every 15 minutes
}

module.exports = {
  startPolling,
  getLatestWeather,
  getHistoricalWeather,
  getWeatherConditions,
};
