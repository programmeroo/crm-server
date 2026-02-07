const { Router } = require('express');
const Workspace = require('../models/Workspace');

const router = Router();

// List workspaces
router.get('/', (req, res) => {
  const workspaces = Workspace.findByUserId(req.user.id);
  res.render('workspaces/index', { workspaces });
});

// New workspace form
router.get('/new', (req, res) => {
  res.render('workspaces/new');
});

// Create workspace
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Workspace name is required');
    return res.redirect('/workspaces/new');
  }
  Workspace.create({ userId: req.user.id, name: name.trim(), description: description?.trim() });
  req.flash('success', 'Workspace created');
  res.redirect('/workspaces');
});

// Edit workspace form
router.get('/:id/edit', (req, res) => {
  const workspace = Workspace.findById(req.params.id);
  if (!workspace || workspace.user_id !== req.user.id) {
    req.flash('error', 'Workspace not found');
    return res.redirect('/workspaces');
  }
  res.render('workspaces/edit', { workspace });
});

// Update workspace
router.post('/:id', (req, res) => {
  const workspace = Workspace.findById(req.params.id);
  if (!workspace || workspace.user_id !== req.user.id) {
    req.flash('error', 'Workspace not found');
    return res.redirect('/workspaces');
  }
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Workspace name is required');
    return res.redirect(`/workspaces/${req.params.id}/edit`);
  }
  Workspace.update(req.params.id, { name: name.trim(), description: description?.trim() });
  req.flash('success', 'Workspace updated');
  res.redirect('/workspaces');
});

// Activate workspace
router.post('/:id/activate', (req, res) => {
  const workspace = Workspace.findById(req.params.id);
  if (!workspace || workspace.user_id !== req.user.id) {
    req.flash('error', 'Workspace not found');
    return res.redirect('/workspaces');
  }
  req.session.activeWorkspaceId = workspace.id;
  req.flash('success', `Switched to ${workspace.name}`);
  res.redirect('/');
});

// Delete workspace
router.post('/:id/delete', (req, res) => {
  const workspace = Workspace.findById(req.params.id);
  if (!workspace || workspace.user_id !== req.user.id) {
    req.flash('error', 'Workspace not found');
    return res.redirect('/workspaces');
  }
  Workspace.delete(req.params.id);
  req.flash('success', 'Workspace deleted');
  res.redirect('/workspaces');
});

module.exports = router;
