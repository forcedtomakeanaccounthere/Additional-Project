const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'forecast-engine' },
    severity: { type: String, enum: ['info', 'warning', 'critical'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    action: { type: String, default: '' },
    active: { type: Boolean, default: true },
    metadata: { type: Object, default: {} },
    triggeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
