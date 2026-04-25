const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'groundwater-dashboard-api',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
