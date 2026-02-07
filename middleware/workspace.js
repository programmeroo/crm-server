const Workspace = require('../models/Workspace');

function loadWorkspace(req, res, next) {
  req.workspace = null;
  res.locals.workspace = null;
  res.locals.workspaces = [];

  if (!req.user) return next();

  // Load all user's workspaces for the switcher
  res.locals.workspaces = Workspace.findByUserId(req.user.id);

  // Load active workspace from session
  if (req.session.activeWorkspaceId) {
    const ws = Workspace.findById(req.session.activeWorkspaceId);
    if (ws && ws.user_id === req.user.id) {
      req.workspace = ws;
      res.locals.workspace = ws;
    } else {
      // Invalid or not owned — clear it
      req.session.activeWorkspaceId = null;
    }
  }

  next();
}

function requireWorkspace(req, res, next) {
  if (req.workspace) return next();
  req.flash('error', 'Please select a workspace');
  res.redirect('/workspaces');
}

module.exports = { loadWorkspace, requireWorkspace };
