require('dotenv/config');
const express = require('express');
const flash = require('connect-flash');
const path = require('path');
const { initDb } = require('./config/database');
const { createSessionMiddleware } = require('./config/session');
const { requireAuth, guestOnly } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const workspaceRoutes = require('./routes/workspaces');
const { getDb } = require('./config/database');

const app = express();

// Initialize database tables
initDb();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(createSessionMiddleware());
app.use(flash());

// Make flash messages available to all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = null;
  next();
});

// Auth routes (no auth required)
app.get('/login', guestOnly, (req, res, next) => next());
app.post('/login', guestOnly, (req, res, next) => next());
app.use('/', authRoutes);

// Static pages (no auth required)
app.get('/help', (req, res) => res.render('help'));
app.get('/feedback', (req, res) => res.render('feedback'));
app.get('/privacy', (req, res) => res.render('privacy'));
app.get('/terms', (req, res) => res.render('terms'));

// --- All routes below require authentication ---
app.use(requireAuth);

// Dashboard
app.get('/', (req, res) => {
  const db = getDb();
  const stats = db.prepare('SELECT COUNT(*) as count FROM contacts').get();
  res.render('index', { count: stats.count });
});

// Contacts
app.use('/contacts', contactRoutes);

// Workspaces
app.use('/workspaces', workspaceRoutes);

module.exports = app;
