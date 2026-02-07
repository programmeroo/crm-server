const User = require('../models/User');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.flash('error', 'Please log in');
    return res.redirect('/login');
  }

  const user = User.findById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
    return;
  }

  req.user = user;
  res.locals.user = user;
  next();
}

function guestOnly(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  next();
}

module.exports = { requireAuth, guestOnly };
