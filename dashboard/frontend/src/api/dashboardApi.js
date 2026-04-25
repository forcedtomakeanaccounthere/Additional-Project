import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

export async function fetchSnapshot(horizon = 24, refresh = false) {
  const response = await client.get('/dashboard/snapshot', {
    params: {
      horizon,
      refresh,
    },
  });
  return response.data;
}

export async function refreshSnapshot(horizon = 24) {
  const response = await client.post('/dashboard/refresh', { horizon });
  return response.data;
}

export async function checkHealth() {
  const response = await client.get('/health');
  return response.data;
}

export async function fetchWaterLevel() {
  const response = await client.get('/water-level');
  return response.data;
}

export async function fetchWeatherConditions(range = 'hourly') {
  const response = await client.get('/weather/conditions', {
    params: { range },
  });
  return response.data;
}
