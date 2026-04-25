require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db');
const { startPolling } = require('./services/weatherService');
const { startSimulation } = require('./services/waterLevelService');

const PORT = Number(process.env.PORT || 5000);

async function bootstrap() {
  await connectDB();

  startPolling();
  startSimulation();

  app.listen(PORT, () => {
    console.log(`[server] API listening on http://localhost:${PORT}`);
  });
}

bootstrap();
