const bcrypt = require('bcrypt');
const { getDb } = require('../config/database');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

const User = {
  async create({ username, password, displayName, email }) {
    const db = getDb();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, email)
      VALUES (?, ?, ?, ?)
    `).run(username, passwordHash, displayName, email || null);

    return User.findById(result.lastInsertRowid);
  },

  findByUsername(username) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
  },

  findById(id) {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, display_name, email, created_at, updated_at FROM users WHERE id = ?'
    ).get(id);
    return user || null;
  },

  async verifyPassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  },

  getAll() {
    const db = getDb();
    return db.prepare(
      'SELECT id, username, display_name, email, created_at, updated_at FROM users'
    ).all();
  }
};

module.exports = User;
