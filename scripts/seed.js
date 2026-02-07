require('dotenv/config');
const { initDb, closeDb } = require('../config/database');
const User = require('../models/User');

async function seed() {
  initDb();

  const users = [
    { username: 'andy', displayName: 'Andy', password: 'changeme123' },
    { username: 'monalisa', displayName: 'Monalisa', password: 'changeme123' }
  ];

  for (const userData of users) {
    const existing = User.findByUsername(userData.username);
    if (existing) {
      console.log(`User "${userData.username}" already exists — skipping`);
      continue;
    }

    await User.create({
      username: userData.username,
      password: userData.password,
      displayName: userData.displayName
    });
    console.log(`Created user: ${userData.username}`);
  }

  closeDb();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
