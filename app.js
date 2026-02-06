require('dotenv/config');
const express = require('express');
const path = require('path');
const { getDb, initDb } = require('./config/database');

const app = express();

// Initialize database tables
initDb();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ROUTES

// Dashboard
app.get('/', (req, res) => {
  const db = getDb();
  const stats = db.prepare('SELECT COUNT(*) as count FROM contacts').get();
  res.render('index', { count: stats.count });
});

// List contacts
app.get('/contacts', (req, res) => {
  const db = getDb();
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY name').all();
  res.render('contacts', { contacts });
});

// Add contact
app.post('/contacts/add', (req, res) => {
  const db = getDb();
  const { name, email } = req.body;
  db.prepare('INSERT INTO contacts (name, email, last_contact) VALUES (?, ?, ?)').run(
    name, email, new Date().toISOString()
  );
  res.redirect('/contacts');
});

// Edit page
app.get('/contacts/edit/:id', (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.render('edit_contact', { contact });
});

// Update contact
app.post('/contacts/update/:id', (req, res) => {
  const db = getDb();
  const { name, email } = req.body;
  db.prepare('UPDATE contacts SET name = ?, email = ? WHERE id = ?')
    .run(name, email, req.params.id);
  res.redirect('/contacts');
});

// Delete contact
app.post('/contacts/delete/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.redirect('/contacts');
});

// Static pages
app.get('/help', (req, res) => res.render('help'));
app.get('/feedback', (req, res) => res.render('feedback'));
app.get('/privacy', (req, res) => res.render('privacy'));
app.get('/terms', (req, res) => res.render('terms'));

module.exports = app;
