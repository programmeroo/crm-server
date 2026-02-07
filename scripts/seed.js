require('dotenv/config');
const { initDb, closeDb } = require('../config/database');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

const SEED_DATA = [
  {
    username: 'andy',
    displayName: 'Andy',
    password: 'changeme123',
    workspaces: [
      { name: 'Loan Factory', description: 'Loan Factory contacts and campaigns' },
      { name: 'MaiStory', description: 'MaiStory business contacts' },
      { name: 'RateReady Realtors', description: 'RateReady realtor network' },
      { name: 'Real Estate Open Houses', description: 'Open house leads and contacts' },
      { name: 'AI Consulting', description: 'AI consulting clients' },
      { name: 'Family & Friends', description: 'Personal contacts' }
    ]
  },
  {
    username: 'monalisa',
    displayName: 'Monalisa',
    password: 'changeme123',
    workspaces: [
      { name: 'Coldwell Banker Contacts', description: 'Coldwell Banker network' },
      { name: 'Real Estate Open Houses', description: 'Open house leads and contacts' },
      { name: 'Family & Friends', description: 'Personal contacts' }
    ]
  }
];

async function seed() {
  initDb();

  for (const userData of SEED_DATA) {
    // Create user if not exists
    let user = User.findByUsername(userData.username);
    if (!user) {
      await User.create({
        username: userData.username,
        password: userData.password,
        displayName: userData.displayName
      });
      user = User.findByUsername(userData.username);
      console.log(`Created user: ${userData.username}`);
    } else {
      console.log(`User "${userData.username}" already exists — skipping`);
    }

    // Create workspaces if not exists
    const existing = Workspace.findByUserId(user.id);
    const existingNames = existing.map(w => w.name);

    for (const wsData of userData.workspaces) {
      if (existingNames.includes(wsData.name)) {
        console.log(`  Workspace "${wsData.name}" already exists — skipping`);
        continue;
      }
      Workspace.create({ userId: user.id, name: wsData.name, description: wsData.description });
      console.log(`  Created workspace: ${wsData.name}`);
    }
  }

  closeDb();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
