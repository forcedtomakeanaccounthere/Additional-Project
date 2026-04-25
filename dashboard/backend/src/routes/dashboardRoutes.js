const express = require('express');

const { getSnapshot, clearSnapshotCache } = require('../services/forecastService');
const { persistSnapshot, shapeDashboardResponse } = require('../services/dashboardService');

const router = express.Router();

router.get('/snapshot', async (req, res) => {
  try {
    const horizon = Number(req.query.horizon || 24);
    const useCache = req.query.refresh !== 'true';
    const snapshot = await getSnapshot({ horizon, useCache });

    if (useCache === false) {
      await persistSnapshot(snapshot);
    }

    res.json(shapeDashboardResponse(snapshot));
  } catch (error) {
    res.status(500).json({
      error: 'snapshot_unavailable',
      message: error.message,
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    clearSnapshotCache();
    const horizon = Number(req.body?.horizon || 24);
    const snapshot = await getSnapshot({ horizon, useCache: false });
    await persistSnapshot(snapshot);

    res.json({
      refreshed: true,
      generatedAt: snapshot.generatedAt,
    });
  } catch (error) {
    res.status(500).json({
      refreshed: false,
      message: error.message,
    });
  }
});

module.exports = router;
