const { Router } = require('express');
const Contact = require('../models/Contact');

const router = Router();

// List contacts
router.get('/', (req, res) => {
  const { search, sort } = req.query;
  const contacts = Contact.findByWorkspaceId(req.workspace.id, {
    search,
    sortBy: sort
  });
  res.render('contacts/index', { contacts, search: search || '' });
});

// Add contact
router.post('/add', (req, res) => {
  const { first_name, last_name, company, birthday, notes } = req.body;

  if (!first_name || !first_name.trim()) {
    req.flash('error', 'First name is required');
    return res.redirect('/contacts');
  }

  Contact.create({
    workspaceId: req.workspace.id,
    firstName: first_name.trim(),
    lastName: last_name ? last_name.trim() : null,
    company: company ? company.trim() : null,
    birthday: birthday || null,
    notes: notes ? notes.trim() : null
  });

  req.flash('success', 'Contact added');
  res.redirect('/contacts');
});

// Edit page
router.get('/edit/:id', (req, res) => {
  const contact = Contact.findById(req.params.id);
  if (!contact || contact.workspace_id !== req.workspace.id) {
    req.flash('error', 'Contact not found');
    return res.redirect('/contacts');
  }
  res.render('contacts/edit', { contact });
});

// Update contact
router.post('/update/:id', (req, res) => {
  const contact = Contact.findById(req.params.id);
  if (!contact || contact.workspace_id !== req.workspace.id) {
    req.flash('error', 'Contact not found');
    return res.redirect('/contacts');
  }

  const { first_name, last_name, company, birthday, notes } = req.body;

  if (!first_name || !first_name.trim()) {
    req.flash('error', 'First name is required');
    return res.redirect(`/contacts/edit/${contact.id}`);
  }

  Contact.update(contact.id, {
    first_name: first_name.trim(),
    last_name: last_name ? last_name.trim() : null,
    company: company ? company.trim() : null,
    birthday: birthday || null,
    notes: notes ? notes.trim() : null
  });

  req.flash('success', 'Contact updated');
  res.redirect('/contacts');
});

// Delete contact
router.post('/delete/:id', (req, res) => {
  const contact = Contact.findById(req.params.id);
  if (!contact || contact.workspace_id !== req.workspace.id) {
    req.flash('error', 'Contact not found');
    return res.redirect('/contacts');
  }

  Contact.delete(contact.id);
  req.flash('success', 'Contact deleted');
  res.redirect('/contacts');
});

module.exports = router;
