const mongoose = require('mongoose');

const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const Snapshot = require('../models/Snapshot');

async function persistSnapshot(snapshot) {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  await Snapshot.create({
    generatedAt: new Date(snapshot.generatedAt || Date.now()),
    payload: snapshot,
  });

  const alerts = (snapshot.alerts || []).map((item) => ({
    severity: item.level || 'info',
    title: item.title || 'Alert',
    message: item.message || '',
    action: item.action || '',
    metadata: {
      generatedAt: snapshot.generatedAt,
    },
  }));

  const notifications = (snapshot.notifications || []).map((item) => ({
    level: item.level || 'info',
    title: item.title || 'Notification',
    message: item.message || '',
    metadata: {
      action: item.action || '',
      generatedAt: snapshot.generatedAt,
    },
  }));

  if (alerts.length > 0) {
    await Alert.insertMany(alerts);
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
}

function shapeDashboardResponse(snapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    weatherSource: snapshot.weatherSource || 'historical',
    location: snapshot.location || null,
    overview: snapshot.overview || {},
    environmental: snapshot.environmental || {},
    operations: snapshot.operations || {},
    alerts: snapshot.alerts || [],
    notifications: snapshot.notifications || [],
    systemLogs: snapshot.systemLogs || [],
  };
}

module.exports = {
  persistSnapshot,
  shapeDashboardResponse,
};
