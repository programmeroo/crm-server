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

function migrateContacts(conn) {
  conn.pragma('foreign_keys = OFF');

  conn.prepare(`
    CREATE TABLE contacts_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      primary_list_id INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT,
      company TEXT,
      birthday TEXT,
      marital_status TEXT,
      spouse_contact_id INTEGER,
      children_names TEXT,
      pet_names TEXT,
      referred_by TEXT,
      transaction_notes TEXT,
      notes TEXT,
      do_not_contact INTEGER DEFAULT 0,
      shared_with_user_id INTEGER,
      last_contact_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (spouse_contact_id) REFERENCES contacts(id),
      FOREIGN KEY (shared_with_user_id) REFERENCES users(id)
    )
  `).run();

  // Get a default workspace_id for migrated contacts
  const ws = conn.prepare('SELECT id FROM workspaces ORDER BY id LIMIT 1').get();
  const defaultWsId = ws ? ws.id : 1;

  const oldContacts = conn.prepare('SELECT * FROM contacts').all();
  const insert = conn.prepare(`
    INSERT INTO contacts_new (workspace_id, first_name, last_name, last_contact_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const contact of oldContacts) {
    const parts = (contact.name || '').trim().split(/\s+/);
    const firstName = parts[0] || 'Unknown';
    const lastName = parts.slice(1).join(' ') || null;
    insert.run(defaultWsId, firstName, lastName, contact.last_contact);
  }

  conn.prepare('DROP TABLE contacts').run();
  conn.prepare('ALTER TABLE contacts_new RENAME TO contacts').run();
  conn.pragma('foreign_keys = ON');
}

function initDb() {
  const conn = getDb();

  conn.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  conn.prepare(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      email_provider TEXT,
      email_config TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();

  // Check contacts table state
  const tableInfo = conn.prepare("PRAGMA table_info(contacts)").all();
  const hasOldSchema = tableInfo.some(col => col.name === 'name') &&
                       !tableInfo.some(col => col.name === 'workspace_id');

  if (tableInfo.length === 0) {
    // No contacts table — create with new schema
    conn.prepare(`
      CREATE TABLE contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        primary_list_id INTEGER,
        first_name TEXT NOT NULL,
        last_name TEXT,
        company TEXT,
        birthday TEXT,
        marital_status TEXT,
        spouse_contact_id INTEGER,
        children_names TEXT,
        pet_names TEXT,
        referred_by TEXT,
        transaction_notes TEXT,
        notes TEXT,
        do_not_contact INTEGER DEFAULT 0,
        shared_with_user_id INTEGER,
        last_contact_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (spouse_contact_id) REFERENCES contacts(id),
        FOREIGN KEY (shared_with_user_id) REFERENCES users(id)
      )
    `).run();
  } else if (hasOldSchema) {
    migrateContacts(conn);
  }
}

module.exports = { getDb, closeDb, initDb };
