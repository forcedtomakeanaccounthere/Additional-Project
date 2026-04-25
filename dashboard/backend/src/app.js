const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const healthRoutes = require('./routes/healthRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { getHistoricalWeather, getWeatherConditions } = require('./services/weatherService');
const { getWaterLevelHistory } = require('./services/waterLevelService');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    service: 'Groundwater Monitoring API',
    docs: '/api/health, /api/dashboard/snapshot, /api/weather, /api/weather/conditions, /api/water-level',
  });
});

app.get('/api/weather', (req, res) => {
  // returns historical weather data
  res.json(getHistoricalWeather());
});

app.get('/api/weather/conditions', (req, res) => {
  const range = req.query.range || 'hourly';
  res.json(getWeatherConditions(range));
});

app.get('/api/water-level', (req, res) => {
  // returns raw CSV string like the user asked
  res.send(getWaterLevelHistory());
});

app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'internal_server_error',
    message: err.message,
  });
});

module.exports = app;
