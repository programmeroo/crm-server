const { Router } = require('express');
const User = require('../models/User');

const router = Router();

// GET /login
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('auth/login', {
    error: req.flash('error'),
    success: req.flash('success')
  });
});

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.flash('error', 'Username and password are required');
    return res.redirect('/login');
  }

  const user = User.findByUsername(username);
  if (!user) {
    req.flash('error', 'Invalid username or password');
    return res.redirect('/login');
  }

  const valid = await User.verifyPassword(password, user.password_hash);
  if (!valid) {
    req.flash('error', 'Invalid username or password');
    return res.redirect('/login');
  }

  req.session.userId = user.id;
  req.flash('success', `Welcome back, ${user.display_name}!`);
  res.redirect('/');
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
