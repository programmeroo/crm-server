const { getDb } = require('../config/database');

const Workspace = {
  create({ userId, name, description }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO workspaces (user_id, name, description)
      VALUES (?, ?, ?)
    `).run(userId, name, description || null);
    return Workspace.findById(result.lastInsertRowid);
  },

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) || null;
  },

  findByUserId(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM workspaces WHERE user_id = ? ORDER BY name').all(userId);
  },

  update(id, { name, description }) {
    const db = getDb();
    db.prepare(`
      UPDATE workspaces SET name = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, description || null, id);
    return Workspace.findById(id);
  },

  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  }
};

module.exports = Workspace;
