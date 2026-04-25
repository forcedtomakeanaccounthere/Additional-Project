const mongoose = require('mongoose');

const SnapshotSchema = new mongoose.Schema(
  {
    generatedAt: { type: Date, required: true },
    payload: { type: Object, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Snapshot || mongoose.model('Snapshot', SnapshotSchema);
