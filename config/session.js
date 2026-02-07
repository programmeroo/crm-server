const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const { getDb } = require('./database');

function createSessionMiddleware() {
  const db = getDb();

  return session({
    store: new SqliteStore({
      client: db,
      expired: {
        clear: true,
        intervalMs: 900000 // 15 min cleanup
      }
    }),
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    }
  });
}

module.exports = { createSessionMiddleware };
