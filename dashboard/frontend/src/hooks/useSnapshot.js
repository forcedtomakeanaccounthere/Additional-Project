import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchSnapshot, refreshSnapshot } from '../api/dashboardApi';

const EMPTY_SNAPSHOT = {
  generatedAt: '',
  overview: {
    liveTankLevel: 0,
    maxForecastLevel: 0,
    recommendedPumps: 0,
    capacityThreshold: 85,
    weeklyDistribution: [],
    forecastSeries: [],
  },
  environmental: {
    precipitationVsGroundwater: [],
    saturationGrid: [],
    regionalForecast: [],
  },
  operations: {
    pumpRecommendation: {
      recommendedPumps: 0,
      maxAllowedPumps: 2,
      severity: 'normal',
      maxPredictedLevel: 0,
      targetLevel: 58,
      hoursToHighThreshold: 0,
      perPumpCapacityPctPerHour: 3.5,
    },
    pumpStatus: [],
    activityLog: [],
    maintenance: [],
  },
  alerts: [],
  notifications: [],
  systemLogs: [],
};

export function useSnapshot(initialHorizon = 24) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [horizon, setHorizon] = useState(initialHorizon);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSnapshot = useCallback(async (nextHorizon = initialHorizon, force = false) => {
    setLoading(!force);
    setRefreshing(force);
    setError('');

    try {
      if (force) {
        await refreshSnapshot(nextHorizon);
      }
      const data = await fetchSnapshot(nextHorizon, false);
      setSnapshot(data);
      setHorizon(nextHorizon);
    } catch (err) {
      const message = err?.response?.data?.message || err.message || 'Failed to load dashboard data.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialHorizon]);

  useEffect(() => {
    loadSnapshot(initialHorizon, false);
  }, [initialHorizon, loadSnapshot]);

  const summary = useMemo(() => {
    const live = snapshot.overview?.liveTankLevel || 0;
    const max = snapshot.overview?.maxForecastLevel || 0;
    const pumps = snapshot.overview?.recommendedPumps || 0;
    const threshold = snapshot.overview?.capacityThreshold || 85;
    const utilization = threshold > 0 ? Math.min(100, (live / threshold) * 100) : 0;

    return {
      live,
      max,
      pumps,
      threshold,
      utilization,
    };
  }, [snapshot]);

  return {
    snapshot,
    summary,
    horizon,
    loading,
    refreshing,
    error,
    setHorizon,
    loadSnapshot,
  };
}
