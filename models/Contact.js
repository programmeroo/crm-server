const { getDb } = require('../config/database');

const Contact = {
  create({ workspaceId, firstName, lastName, company, birthday, notes, email, phone }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO contacts (workspace_id, first_name, last_name, company, birthday, notes, last_contact_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(workspaceId, firstName, lastName || null, company || null, birthday || null, notes || null);
    return Contact.findById(result.lastInsertRowid);
  },

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) || null;
  },

  findByWorkspaceId(workspaceId, { search, sortBy, limit, offset } = {}) {
    const db = getDb();
    let sql = 'SELECT * FROM contacts WHERE workspace_id = ?';
    const params = [workspaceId];

    if (search) {
      sql += ` AND (first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const validSorts = ['first_name', 'last_name', 'company', 'created_at', 'last_contact_at'];
    const order = validSorts.includes(sortBy) ? sortBy : 'first_name';
    sql += ` ORDER BY ${order} COLLATE NOCASE`;

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    return db.prepare(sql).all(...params);
  },

  update(id, fields) {
    const db = getDb();
    const allowed = ['first_name', 'last_name', 'company', 'birthday', 'marital_status',
                     'children_names', 'pet_names', 'referred_by', 'transaction_notes',
                     'notes', 'do_not_contact'];
    const sets = [];
    const params = [];

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = ?`);
        params.push(value ?? null);
      }
    }

    if (sets.length === 0) return Contact.findById(id);

    sets.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return Contact.findById(id);
  },

  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  },

  count(workspaceId) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE workspace_id = ?').get(workspaceId);
    return row.count;
  }
};

module.exports = Contact;
