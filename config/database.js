require('dotenv/config');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/crm.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function initDb() {
  const conn = getDb();

  conn.prepare(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      last_contact TEXT
    )
  `).run();
}

module.exports = { getDb, closeDb, initDb };
