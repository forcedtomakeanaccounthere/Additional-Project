const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['info', 'warning', 'critical'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    acknowledged: { type: Boolean, default: false },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
