const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[db] MONGODB_URI not set. Running without database persistence.');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[db] Connected to MongoDB');
    return true;
  } catch (error) {
    console.warn(`[db] MongoDB connection failed: ${error.message}`);
    return false;
  }
}

module.exports = {
  connectDB,
};
