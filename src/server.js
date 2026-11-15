require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const port = Number(process.env.PORT || 3000);

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is missing or too short. Copy .env.example to .env and set a secret of at least 32 characters.');
  }

  await testConnection();
  app.listen(port, () => {
    console.log(`Railway Reservation System is running at http://localhost:${port}`);
    console.log('Demo payment mode is enabled. No real money will be charged.');
  });
}

start().catch((error) => {
  console.error('Unable to start the application:', error.message);
  process.exit(1);
});
