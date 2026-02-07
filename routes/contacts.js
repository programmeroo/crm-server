const { Router } = require('express');
const { getDb } = require('../config/database');

const router = Router();

// List contacts
router.get('/', (req, res) => {
  const db = getDb();
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY name').all();
  res.render('contacts', { contacts });
});

// Add contact
router.post('/add', (req, res) => {
  const db = getDb();
  const { name, email } = req.body;
  db.prepare('INSERT INTO contacts (name, email, last_contact) VALUES (?, ?, ?)').run(
    name, email, new Date().toISOString()
  );
  res.redirect('/contacts');
});

// Edit page
router.get('/edit/:id', (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.render('edit_contact', { contact });
});

// Update contact
router.post('/update/:id', (req, res) => {
  const db = getDb();
  const { name, email } = req.body;
  db.prepare('UPDATE contacts SET name = ?, email = ? WHERE id = ?')
    .run(name, email, req.params.id);
  res.redirect('/contacts');
});

// Delete contact
router.post('/delete/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.redirect('/contacts');
});

module.exports = router;
