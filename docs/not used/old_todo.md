# Pi-CRM Implementation Checklist

> Track your progress through every step. Check off items as you complete them.
> Each section corresponds to a prompt in `implementation-prompts.md`.

---

## Phase 1: Foundation Refactor

### Step 1.1 — Environment Config + Project Restructure + Test Framework

- [ ] Create `.env` file with PORT, DATABASE_PATH, SESSION_SECRET, NODE_ENV
- [ ] Create `.env.example` with same vars (safe defaults)
- [ ] Install `dotenv`
- [ ] Install `jest` and `supertest`
- [ ] Add `"test"` script to package.json: `"jest --verbose --forceExit"`
- [ ] Add `"start"` script to package.json: `"node server.js"`
- [ ] Add `"dev"` script to package.json: `"node --watch server.js"`
- [ ] Create directory: `config/`
- [ ] Create directory: `middleware/`
- [ ] Create directory: `models/`
- [ ] Create directory: `routes/`
- [ ] Create directory: `services/`
- [ ] Create directory: `tests/`
- [ ] Create directory: `scripts/`
- [ ] Create directory: `public/css/`
- [ ] Create directory: `public/js/`
- [ ] Create `config/database.js` with `getDb()` singleton, WAL mode, `closeDb()`
- [ ] Move contacts table creation to `config/database.js` as `initDb()`
- [ ] Update `server.js` to use dotenv and `config/database.js`
- [ ] Verify all existing routes still work identically
- [ ] Create `tests/setup.js` with NODE_ENV=test and test database path
- [ ] Create `tests/smoke.test.js` with GET /, GET /contacts, POST /contacts/add tests
- [ ] Update `.gitignore` to include `data/test-*.db`
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm start` — app works at localhost:3000

### Step 1.2 — Separate app.js from server.js

- [ ] Create `app.js` — move all Express config, middleware, routes from server.js
- [ ] `app.js` calls `initDb()` and exports app (no `app.listen()`)
- [ ] Simplify `server.js` to import app and call `app.listen(PORT)` only
- [ ] Update `tests/smoke.test.js` to import from `app.js`
- [ ] Test: GET / → 200, body contains "Pi-CRM"
- [ ] Test: GET /contacts → 200
- [ ] Test: POST /contacts/add → creates contact, redirects
- [ ] Test: GET /contacts after add → body contains new contact
- [ ] Test: POST /contacts/delete/:id → redirects, contact gone
- [ ] Add jest config to `package.json` (testEnvironment, setupFiles)
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm start` — app works at localhost:3000

---

## Phase 2: Authentication

### Step 2.1 — User Model + Password Hashing + Seed Script

- [ ] Add `users` table creation to `initDb()` in `config/database.js`
- [ ] Install `bcrypt`
- [ ] Create `models/User.js` with methods:
  - [ ] `User.create({ username, password, displayName, email })`
  - [ ] `User.findByUsername(username)`
  - [ ] `User.findById(id)`
  - [ ] `User.verifyPassword(plaintext, hash)`
  - [ ] `User.getAll()`
- [ ] Create `scripts/seed.js` — seeds Andy and Monalisa
- [ ] Add `"seed"` script to package.json
- [ ] Add `BCRYPT_ROUNDS=10` to `.env.example`
- [ ] Create `tests/user.test.js`:
  - [ ] Test User.create() hashes password
  - [ ] Test User.findByUsername() returns user
  - [ ] Test User.verifyPassword() correct/incorrect
  - [ ] Test duplicate username throws error
- [ ] Run `npm run seed` — users created
- [ ] Run `npm test` — all tests pass

### Step 2.2 — Login/Logout Routes + Session Management + Login View

- [ ] Install `express-session`
- [ ] Install `better-sqlite3-session-store`
- [ ] Install `connect-flash`
- [ ] Create `config/session.js` — session middleware with SQLite store
- [ ] Add `sessions` table creation to `initDb()`
- [ ] Create `routes/auth.js`:
  - [ ] GET /login → render login form
  - [ ] POST /login → validate credentials, set session, redirect
  - [ ] POST /logout → destroy session, redirect to /login
- [ ] Create `views/auth/login.ejs` — login form with Tailwind
- [ ] Create `views/partials/flash-messages.ejs` — success/error messages, auto-dismiss
- [ ] Wire session middleware into `app.js`
- [ ] Wire connect-flash into `app.js`
- [ ] Mount auth routes in `app.js`
- [ ] Update `views/partials/header.ejs` — include flash messages, show user name
- [ ] Verify: /login shows form
- [ ] Verify: login with valid creds → redirects to /
- [ ] Verify: login with bad creds → error flash
- [ ] Verify: /logout → back to /login
- [ ] Run `npm test` — existing tests still pass

### Step 2.3 — Auth Middleware + Route Protection

- [ ] Create `middleware/auth.js`:
  - [ ] `requireAuth` — check session, load user, redirect if not logged in
  - [ ] `guestOnly` — redirect to / if already logged in
- [ ] Apply `guestOnly` to login routes in `app.js`
- [ ] Apply `requireAuth` to all other routes in `app.js`
- [ ] Update `views/partials/header.ejs`:
  - [ ] Show `user.display_name`
  - [ ] Show Logout button (POST form)
  - [ ] Only show nav links when logged in
- [ ] Extract contact routes into `routes/contacts.js`
- [ ] Mount contacts routes with `requireAuth` in `app.js`
- [ ] Create `tests/auth.test.js`:
  - [ ] Test: GET / without session → redirect to /login
  - [ ] Test: GET /contacts without session → redirect to /login
  - [ ] Test: POST /login valid → sets session, redirects
  - [ ] Test: POST /login invalid → stays on /login
  - [ ] Test: POST /logout → clears session
  - [ ] Test: GET / with valid session → 200
- [ ] Run `npm test` — all tests pass
- [ ] Verify: unauthenticated access redirects to /login

---

## Phase 3: Workspaces

### Step 3.1 — Workspace Model + CRUD Routes + Views

- [ ] Add `workspaces` table creation to `initDb()`
- [ ] Create `models/Workspace.js`:
  - [ ] `Workspace.create({ userId, name, description })`
  - [ ] `Workspace.findById(id)`
  - [ ] `Workspace.findByUserId(userId)`
  - [ ] `Workspace.update(id, { name, description })`
  - [ ] `Workspace.delete(id)`
- [ ] Create `routes/workspaces.js`:
  - [ ] GET /workspaces → list
  - [ ] GET /workspaces/new → create form
  - [ ] POST /workspaces → create
  - [ ] GET /workspaces/:id/edit → edit form
  - [ ] POST /workspaces/:id → update
  - [ ] POST /workspaces/:id/delete → delete
  - [ ] All routes scoped to `req.user.id`
- [ ] Create `views/workspaces/index.ejs` — card grid
- [ ] Create `views/workspaces/new.ejs` — create form
- [ ] Create `views/workspaces/edit.ejs` — edit form
- [ ] Mount workspace routes in `app.js`
- [ ] Add "Workspaces" link to nav in `header.ejs`
- [ ] Create `tests/workspaces.test.js`:
  - [ ] Test creating a workspace
  - [ ] Test listing only own workspaces (user isolation)
  - [ ] Test editing a workspace
  - [ ] Test deleting a workspace
  - [ ] Test user A cannot access user B's workspace
- [ ] Run `npm test` — all tests pass

### Step 3.2 — Workspace Switcher + Scoping Middleware

- [ ] Create `middleware/workspace.js`:
  - [ ] `loadWorkspace` — load active workspace from session
  - [ ] `requireWorkspace` — redirect if no workspace selected
- [ ] Wire `loadWorkspace` into `app.js` after `requireAuth`
- [ ] Add POST /workspaces/:id/activate route
- [ ] Create `views/partials/workspace-switcher.ejs` — dropdown in nav
- [ ] Update `views/partials/header.ejs` — include workspace switcher
- [ ] Update dashboard route (GET /):
  - [ ] With workspace: show workspace-specific info
  - [ ] Without workspace: show "select a workspace" prompt
- [ ] Update `routes/contacts.js` to pass `req.workspace` to views
- [ ] Verify: workspace switcher shows in nav
- [ ] Verify: selecting workspace updates nav and dashboard
- [ ] Run `npm test` — all tests pass

### Step 3.3 — Seed Default Workspaces + Integration Tests

- [ ] Update `scripts/seed.js` — create default workspaces:
  - [ ] Andy: Loan Factory, MaiStory, RateReady Realtors, Real Estate Open Houses, AI Consulting, Family & Friends
  - [ ] Monalisa: Coldwell Banker Contacts, Real Estate Open Houses, Family & Friends
- [ ] Seed script is idempotent (no duplicates on re-run)
- [ ] Update `tests/workspaces.test.js`:
  - [ ] Test workspace activation sets session
  - [ ] Test workspace switcher shows only own workspaces
  - [ ] Test requireWorkspace redirects when none active
  - [ ] Test workspace scoping context
- [ ] Run `npm run seed` — creates users + workspaces
- [ ] Verify: Andy sees 6 workspaces, Monalisa sees 3
- [ ] Run `npm test` — all tests pass

---

## Phase 4: Contact Model Overhaul

### Step 4.1 — New Contacts Schema + Data Migration

- [ ] Update `initDb()` — new contacts table with all core fields
- [ ] Implement migration logic for old contacts table:
  - [ ] Detect old schema (has `name` but no `workspace_id`)
  - [ ] Split `name` into `first_name` / `last_name`
  - [ ] Set `workspace_id` from first workspace
  - [ ] Copy `last_contact` → `last_contact_at`
  - [ ] Rename tables, drop old
- [ ] Create `models/Contact.js`:
  - [ ] `Contact.create({ workspaceId, firstName, lastName, company, ... })`
  - [ ] `Contact.findById(id)`
  - [ ] `Contact.findByWorkspaceId(workspaceId, { search, sortBy, limit, offset })`
  - [ ] `Contact.update(id, fields)`
  - [ ] `Contact.delete(id)`
  - [ ] `Contact.count(workspaceId)`
- [ ] Update `routes/contacts.js` — use new Contact model, filter by workspace
- [ ] Move `contacts.ejs` → `views/contacts/index.ejs`, update for new fields
- [ ] Create `tests/contacts.test.js`:
  - [ ] Test creating contact in workspace
  - [ ] Test listing only active workspace contacts
  - [ ] Test contact isolation between workspaces
  - [ ] Test updating and deleting
  - [ ] Test search/filter
- [ ] Run `npm run seed` — existing contacts migrated
- [ ] Run `npm test` — all tests pass

### Step 4.2 — Contact Emails & Phones Tables

- [ ] Add `contact_emails` table to `initDb()`
- [ ] Add `contact_phones` table to `initDb()`
- [ ] Create `models/ContactEmail.js`:
  - [ ] `ContactEmail.create({ contactId, email, isPrimary, label })`
  - [ ] `ContactEmail.findByContactId(contactId)`
  - [ ] `ContactEmail.getPrimary(contactId)`
  - [ ] `ContactEmail.setPrimary(contactId, emailId)`
  - [ ] `ContactEmail.delete(id)`
- [ ] Create `models/ContactPhone.js`:
  - [ ] `ContactPhone.create({ contactId, phone, isPrimary, label })`
  - [ ] `ContactPhone.findByContactId(contactId)`
  - [ ] `ContactPhone.getPrimary(contactId)`
  - [ ] `ContactPhone.setPrimary(contactId, phoneId)`
  - [ ] `ContactPhone.delete(id)`
- [ ] Update `Contact.create()` — accept and create primary email/phone
- [ ] Update `Contact.findByWorkspaceId()` — join with primary email/phone
- [ ] Update `views/contacts/index.ejs` — show primary email and phone columns
- [ ] Create `tests/contact-emails-phones.test.js`:
  - [ ] Test creating contact with email and phone
  - [ ] Test adding secondary emails
  - [ ] Test promoting secondary email to primary
  - [ ] Test deleting an email
  - [ ] Test cascade delete (contact → emails/phones)
- [ ] Run `npm test` — all tests pass

### Step 4.3 — Contact CRUD Views (Workspace-Scoped)

- [ ] Create `views/contacts/new.ejs`:
  - [ ] Basic Info section: first name*, last name, company
  - [ ] Contact Info section: primary email, primary phone + label
  - [ ] Personal section: birthday, marital status, children, pets
  - [ ] Business section: referred by
  - [ ] Notes section: transaction notes, general notes
- [ ] Update `routes/contacts.js`:
  - [ ] GET /contacts/new → render new.ejs
  - [ ] POST /contacts → create with all fields + email + phone
  - [ ] GET /contacts/:id/edit → render edit.ejs
  - [ ] POST /contacts/:id → update
  - [ ] Validate contact belongs to active workspace
- [ ] Create `views/contacts/edit.ejs`:
  - [ ] Pre-filled with all contact data
  - [ ] Email management: list, add, set primary, delete
  - [ ] Phone management: list, add, set primary, delete
- [ ] Add email/phone management routes:
  - [ ] POST /contacts/:id/emails/add
  - [ ] POST /contacts/:id/emails/:emailId/set-primary
  - [ ] POST /contacts/:id/emails/:emailId/delete
  - [ ] POST /contacts/:id/phones/add
  - [ ] POST /contacts/:id/phones/:phoneId/set-primary
  - [ ] POST /contacts/:id/phones/:phoneId/delete
- [ ] Update `views/contacts/index.ejs`:
  - [ ] "New Contact" button
  - [ ] Edit / Delete action links per row
  - [ ] Search box with `?search=` query param
- [ ] Add search to `Contact.findByWorkspaceId()` — LIKE on name/email/company
- [ ] Verify: create contact with all fields → appears in list
- [ ] Verify: edit contact → fields pre-filled, can modify
- [ ] Verify: search contacts works
- [ ] Run `npm test` — all tests pass

### Step 4.4 — Contact Detail Page + Duplicate Detection

- [ ] Create `views/contacts/detail.ejs`:
  - [ ] Pinned notices area (placeholder)
  - [ ] Contact header: name, company, email, phone
  - [ ] Contact Info section: all emails + phones with labels and primary badges
  - [ ] Personal section: birthday, marital status, spouse, children, pets
  - [ ] Business section: company, referred by
  - [ ] Transaction / Loan File Notes section (clickable links)
  - [ ] Notes section (timestamped)
  - [ ] Communication Log placeholder
  - [ ] Action buttons: Edit, Delete, Share (placeholder)
  - [ ] Lists section placeholder
- [ ] Add GET /contacts/:id route → render detail.ejs
- [ ] Update `views/contacts/index.ejs` — contact name links to detail page
- [ ] Create `services/duplicate-detector.js`:
  - [ ] `DuplicateDetector.check(workspaceId, { emails, phones })` — match by email OR phone
- [ ] Update POST /contacts — run duplicate check before creating
- [ ] Create `views/contacts/merge.ejs`:
  - [ ] Side-by-side comparison view
  - [ ] Per-field radio selectors
  - [ ] Actions: Merge, Keep Separate, Cancel
- [ ] Add merge routes:
  - [ ] GET /contacts/merge
  - [ ] POST /contacts/merge
- [ ] Create `tests/duplicate-detection.test.js`:
  - [ ] Test: same email → duplicate detected
  - [ ] Test: same phone → duplicate detected
  - [ ] Test: no matches → no duplicates
  - [ ] Test: merge combines fields
  - [ ] Test: keep separate creates new contact
- [ ] Run `npm test` — all tests pass

---

## Phase 5: Contact Lists

### Step 5.1 — Contact Lists Model + CRUD + Views

- [ ] Add `contact_lists` table to `initDb()`
- [ ] Add `contact_list_assignments` table to `initDb()`
- [ ] Create `models/ContactList.js`:
  - [ ] `ContactList.create({ workspaceId, name, description, isDefault })`
  - [ ] `ContactList.findByWorkspaceId(workspaceId)`
  - [ ] `ContactList.findById(id)`
  - [ ] `ContactList.update(id, { name, description })`
  - [ ] `ContactList.delete(id)`
  - [ ] `ContactList.getContactCount(listId)`
  - [ ] `ContactList.assignContact(contactId, listId)`
  - [ ] `ContactList.unassignContact(contactId, listId)`
  - [ ] `ContactList.getSecondaryLists(contactId)`
- [ ] Create `routes/lists.js`:
  - [ ] GET /lists → list with contact counts
  - [ ] GET /lists/new → create form
  - [ ] POST /lists → create
  - [ ] GET /lists/:id/edit → edit form
  - [ ] POST /lists/:id → update
  - [ ] POST /lists/:id/delete → delete (only if empty)
  - [ ] GET /lists/:id → contacts in this list
- [ ] Create `views/lists/index.ejs`
- [ ] Create `views/lists/new.ejs`
- [ ] Create `views/lists/edit.ejs`
- [ ] Create `views/lists/view.ejs` — filtered contacts
- [ ] Mount list routes in `app.js` with `requireWorkspace`
- [ ] Add "Lists" link to nav (visible when workspace active)
- [ ] Update `scripts/seed.js`:
  - [ ] Loan Factory lists: Leads, Prospects, Applications, Closed, Lost
  - [ ] Other workspaces: Contacts, Active, Inactive
- [ ] Create `tests/lists.test.js`:
  - [ ] Test creating a list
  - [ ] Test listing only workspace's lists
  - [ ] Test deleting empty list succeeds
  - [ ] Test deleting list with contacts fails/reassigns
- [ ] Run `npm run seed` — default lists created
- [ ] Run `npm test` — all tests pass

### Step 5.2 — Primary List Assignment + Secondary Tags + UI

- [ ] Update `views/contacts/new.ejs` — add Primary List dropdown, Secondary Lists checkboxes
- [ ] Update `views/contacts/edit.ejs` — add Primary List dropdown, Secondary Lists checkboxes
- [ ] Update POST /contacts (create) — accept `primaryListId`, `secondaryListIds[]`
- [ ] Update POST /contacts/:id (update) — sync primary list + secondary assignments
- [ ] Update `views/contacts/detail.ejs`:
  - [ ] Primary list badge (linked)
  - [ ] Secondary list tags
  - [ ] "Change Stage" inline dropdown
- [ ] Update `views/contacts/index.ejs` — show primary list name, add list filter dropdown
- [ ] Update `Contact.findByWorkspaceId()` — accept `listId` filter, join with lists
- [ ] Add POST /contacts/:id/change-list route
- [ ] Create `tests/contact-lists-integration.test.js`:
  - [ ] Test creating contact with primary list
  - [ ] Test assigning secondary lists
  - [ ] Test changing primary list
  - [ ] Test filtering contacts by list
- [ ] Run `npm test` — all tests pass

### Step 5.3 — Stage Change Auto-Logging

- [ ] Add `communication_log` table to `initDb()`
- [ ] Create `models/CommunicationLog.js`:
  - [ ] `CommunicationLog.create({ contactId, userId, type, direction, subject, body, metadata })`
  - [ ] `CommunicationLog.findByContactId(contactId, { type, limit, offset })`
  - [ ] `CommunicationLog.countByContactId(contactId, { type })`
- [ ] Update POST /contacts/:id/change-list — log stage change
- [ ] Update POST /contacts/:id — log if primary_list_id changed
- [ ] Update `views/contacts/detail.ejs` — show recent stage changes from log
- [ ] Create `tests/stage-change-log.test.js`:
  - [ ] Test: changing primary list creates log entry
  - [ ] Test: log entry has correct from/to list names
  - [ ] Test: multiple changes create entries in order
  - [ ] Test: reverse chronological ordering
- [ ] Run `npm test` — all tests pass

---

## Phase 6: Communication Log & Notes

### Step 6.1 — Full Communication Log Display

- [ ] Update `views/contacts/detail.ejs` — tabbed communication log:
  - [ ] Tab: All Activity
  - [ ] Tab: Emails
  - [ ] Tab: Texts / SMS
  - [ ] Tab: Phone Calls
  - [ ] Tab: AI Interactions
  - [ ] Tab: Stage & List Changes
  - [ ] Tab: Notes & Manual Entries
  - [ ] Tab: Other / System Events
- [ ] Each entry: timestamp, type icon/badge, subject/preview, expandable body
- [ ] Reverse chronological, "Load more" pagination (10 per page)
- [ ] Add GET /contacts/:id/log?type=&page= route for pagination
- [ ] Update `CommunicationLog` model:
  - [ ] `CommunicationLog.getTypes(contactId)`
  - [ ] Pagination: `{ page, perPage, type }` in `findByContactId`
- [ ] Create `public/js/log.js`:
  - [ ] Tab switching
  - [ ] Expand/collapse entries
  - [ ] "Load more" fetch
- [ ] Include `log.js` in detail page
- [ ] Create `tests/communication-log.test.js`:
  - [ ] Test creating entries of different types
  - [ ] Test filtering by type
  - [ ] Test pagination
  - [ ] Test reverse chronological ordering
- [ ] Run `npm test` — all tests pass

### Step 6.2 — Manual Notes + Pinned Notices

- [ ] Add "Quick Note" form on detail page:
  - [ ] Textarea + submit
  - [ ] POST /contacts/:id/notes → log type='note'
- [ ] Add "Log Phone Call" form:
  - [ ] Subject, notes, direction dropdown
  - [ ] POST /contacts/:id/log-call → log type='phone_call'
- [ ] Update `last_contact_at` when note/call/email/sms logged:
  - [ ] `Contact.updateLastContact(id)` method
- [ ] Build Pinned Notices section at top of `detail.ejs`:
  - [ ] Last email sent (date + campaign if any)
  - [ ] Current primary list + last change date
  - [ ] Shared status
  - [ ] Do Not Contact flag (red warning)
- [ ] Update GET /contacts/:id — fetch pinned notice data, pass to view
- [ ] Create `tests/notes-notices.test.js`:
  - [ ] Test adding manual note → appears in log
  - [ ] Test logging phone call → appears in log
  - [ ] Test `last_contact_at` updates
  - [ ] Test pinned notices data correct
- [ ] Run `npm test` — all tests pass

---

## Phase 7: Contact Sharing

### Step 7.1 — Share/Unshare + Shared Contacts View

- [ ] Add share toggle to `views/contacts/detail.ejs`:
  - [ ] "Share with [other user]" checkbox (owner only)
- [ ] Add routes:
  - [ ] POST /contacts/:id/share → set `shared_with_user_id`
  - [ ] POST /contacts/:id/unshare → clear `shared_with_user_id`
  - [ ] Log sharing actions in communication_log (type='system')
- [ ] Create `routes/sharing.js`:
  - [ ] GET /shared → list all contacts shared with current user
  - [ ] GET /shared/:id → read-only detail view
- [ ] Create `views/sharing/index.ejs` — shared contacts list (read-only, no edit/delete)
- [ ] Add "Shared with Me" link to nav (with count badge)
- [ ] Create `tests/sharing.test.js`:
  - [ ] Test: owner shares → other user sees in /shared
  - [ ] Test: shared contact is read-only
  - [ ] Test: unshare removes from shared view
  - [ ] Test: non-shared contacts not visible
- [ ] Run `npm test` — all tests pass

### Step 7.2 — Save As Copy + Revoke

- [ ] Add "Save to My Workspace" button on shared contact views
- [ ] Add routes:
  - [ ] GET /shared/:id/save-as → workspace selection form
  - [ ] POST /shared/:id/save-as → copy contact (fields, emails, phones) into target workspace
- [ ] Copied contact:
  - [ ] Gets all fields, emails, phones
  - [ ] Does NOT get communication log or list assignments
  - [ ] Sets primary_list_id to default list in target workspace
  - [ ] Logs type='system' "Copied from shared contact"
- [ ] Verify revoke behavior: unshare removes from shared view, copies remain
- [ ] Update pinned notices: show "Shared with [name] since [date]"
- [ ] Create `tests/save-as.test.js`:
  - [ ] Test: Save As creates independent copy
  - [ ] Test: copy has all fields, emails, phones
  - [ ] Test: copy does NOT have original's log entries
  - [ ] Test: revoking share doesn't affect copies
  - [ ] Test: can only Save As to own workspaces
- [ ] Run `npm test` — all tests pass

---

## Phase 8: Templates

### Step 8.1 — Template Model + CRUD

- [ ] Add `templates` table to `initDb()`
- [ ] Create `models/Template.js`:
  - [ ] `Template.create({ workspaceId, userId, name, subject, preheader, body, placeholders })`
  - [ ] `Template.findById(id)`
  - [ ] `Template.findByWorkspaceId(workspaceId, { search })`
  - [ ] `Template.update(id, fields)`
  - [ ] `Template.delete(id)`
  - [ ] `Template.toggleFavorite(id)`
  - [ ] `Template.extractPlaceholders(body)` — parse `{{placeholder}}` patterns
- [ ] Create `routes/templates.js`:
  - [ ] GET /templates → list
  - [ ] GET /templates/new → create form
  - [ ] POST /templates → create (auto-extract placeholders)
  - [ ] GET /templates/:id → detail/preview
  - [ ] GET /templates/:id/edit → edit form
  - [ ] POST /templates/:id → update
  - [ ] POST /templates/:id/delete → delete
  - [ ] POST /templates/:id/favorite → toggle
- [ ] Create `views/templates/index.ejs` — template list with name, subject, favorite star
- [ ] Create `views/templates/new.ejs` — form with placeholder help text
- [ ] Create `views/templates/edit.ejs`
- [ ] Mount template routes in `app.js` with `requireWorkspace`
- [ ] Add "Templates" link to nav
- [ ] Create `tests/templates.test.js`:
  - [ ] Test creating template
  - [ ] Test placeholder extraction
  - [ ] Test listing scoped to workspace
  - [ ] Test editing and deleting
  - [ ] Test favoriting
- [ ] Run `npm test` — all tests pass

### Step 8.2 — Template Editor with Preview

- [ ] Create `views/templates/editor.ejs`:
  - [ ] Split view: editor left, preview right (stacks on mobile)
  - [ ] Editor: name, subject, preheader, body textarea
  - [ ] Formatting toolbar: bold, italic, link, placeholder dropdown, image URL
  - [ ] Signature section
- [ ] Preview panel:
  - [ ] Renders body as HTML
  - [ ] Replaces placeholders with sample data
  - [ ] Updates in real-time (debounced)
- [ ] Create `public/js/template-editor.js`:
  - [ ] Live preview rendering with placeholder replacement
  - [ ] Placeholder insertion at cursor position
  - [ ] Debounced updates (300ms)
  - [ ] Bold/italic: wrap selection in tags
  - [ ] Link insertion: prompt for URL
- [ ] Update routes:
  - [ ] GET /templates/new → render editor.ejs
  - [ ] GET /templates/:id/edit → render editor.ejs with data
  - [ ] GET /templates/:id/preview → standalone preview
- [ ] Create `views/templates/preview.ejs` — standalone preview with Back to Edit and Send Test Email (placeholder)
- [ ] Create `tests/template-preview.test.js`:
  - [ ] Test template creation via editor
  - [ ] Test placeholder extraction matches body
  - [ ] Test preview route returns rendered HTML
- [ ] Run `npm test` — all tests pass

### Step 8.3 — Copy/Share Templates Between Workspaces

- [ ] Add "Copy to Another Workspace" on template detail/edit:
  - [ ] GET /templates/:id/copy → workspace selection
  - [ ] POST /templates/:id/copy → duplicate into selected workspace
- [ ] Add template sharing:
  - [ ] ALTER TABLE templates ADD COLUMN `shared_with_user_id`
  - [ ] POST /templates/:id/share
  - [ ] POST /templates/:id/unshare
  - [ ] GET /templates/shared → view shared templates
  - [ ] POST /templates/shared/:id/save-as → copy to own workspace
- [ ] Add Global Favorites Library:
  - [ ] GET /templates/favorites → all favorited templates across workspaces
  - [ ] "Push to Workspace" action from favorites
- [ ] Update `views/templates/index.ejs`:
  - [ ] "Shared" tab/section
  - [ ] Copy/share action buttons
- [ ] Create `tests/template-sharing.test.js`:
  - [ ] Test copy to another workspace
  - [ ] Test share → visible read-only
  - [ ] Test save-as creates independent copy
  - [ ] Test favorites list cross-workspace
- [ ] Run `npm test` — all tests pass

---

## Phase 9: CSV Import/Export

### Step 9.1 — CSV Export

- [ ] Install `csv-stringify`
- [ ] Create `services/csv-export.js`:
  - [ ] `exportContacts(contacts, options)` → CSV string
  - [ ] Default fields: First Name, Last Name, Primary Email, Primary Phone, Company, Primary List, Secondary Tags, Created, Last Contact
  - [ ] Field selection support
  - [ ] Proper CSV escaping
- [ ] Create `routes/import-export.js`:
  - [ ] GET /export → export options page
  - [ ] POST /export → generate and download CSV
  - [ ] Correct Content-Type and Content-Disposition headers
  - [ ] Filename: `[workspace]-contacts-[date].csv`
- [ ] Create `views/import-export/export.ejs`:
  - [ ] Workspace selector
  - [ ] List filter
  - [ ] Field checkboxes
  - [ ] Contact count preview
  - [ ] "Export" button
- [ ] Mount import-export routes in `app.js`
- [ ] Add "Import / Export" link to nav
- [ ] Add "Export This List" button to `views/lists/view.ejs`
- [ ] Create `tests/csv-export.test.js`:
  - [ ] Test CSV has correct headers
  - [ ] Test CSV contains all workspace contacts
  - [ ] Test list filter only includes list contacts
  - [ ] Test CSV escaping (commas, quotes)
  - [ ] Test field selection
- [ ] Run `npm test` — all tests pass

### Step 9.2 — CSV Import with Column Mapping + Duplicate Handling

- [ ] Install `csv-parse`
- [ ] Install `multer` (file upload)
- [ ] Create `services/csv-import.js`:
  - [ ] `parseCSV(fileContent)` → `{ headers, rows }`
  - [ ] `mapColumns(rows, mapping)` → transformed rows
  - [ ] `validateRow(row)` → `{ valid, errors }`
  - [ ] `importContacts(workspaceId, userId, rows, options)`:
    - [ ] Duplicate checking
    - [ ] Options: primaryListId, secondaryListIds, onDuplicate
    - [ ] Returns: `{ imported, skipped, errors }`
- [ ] Update `routes/import-export.js`:
  - [ ] GET /import → import page
  - [ ] POST /import/upload → parse CSV, show mapping
  - [ ] POST /import/execute → execute import
- [ ] Create `views/import-export/import.ejs` — file upload (Step 1)
- [ ] Create `views/import-export/import-mapping.ejs`:
  - [ ] Column mapping dropdowns
  - [ ] Auto-map obvious matches
  - [ ] Primary list selector
  - [ ] Secondary list tags
  - [ ] Preview first 5 rows
  - [ ] Duplicate handling option
  - [ ] "Import" button
- [ ] Create `views/import-export/import-results.ejs` — imported/skipped/error counts
- [ ] Handle edge cases: empty rows, missing fields, invalid email, large files
- [ ] Create `tests/csv-import.test.js`:
  - [ ] Test CSV parsing
  - [ ] Test column auto-mapping
  - [ ] Test import creates contacts
  - [ ] Test duplicate detection (skip / create modes)
  - [ ] Test invalid rows skipped with errors
  - [ ] Test list assignments on imported contacts
- [ ] Run `npm test` — all tests pass

---

## Phase 10: Email Integration

### Step 10.1 — Email Provider Configuration

- [ ] Create `views/settings/workspace.ejs`:
  - [ ] Email Provider dropdown: Google Workspace, Mailgun, Microsoft 365, None
  - [ ] Dynamic config fields per provider:
    - [ ] Google Workspace: OAuth2 or App Password
    - [ ] Mailgun: API key, domain, from email
    - [ ] Microsoft 365: OAuth2 or SMTP
  - [ ] "Test Connection" button
  - [ ] "Save" button
- [ ] Create `routes/settings.js`:
  - [ ] GET /settings/workspace → show settings
  - [ ] POST /settings/workspace/email → save config
  - [ ] POST /settings/workspace/email/test → send test email
- [ ] Create `config/email-providers.js` — factory function per provider
- [ ] Install `nodemailer`, `mailgun.js`, `form-data`
- [ ] Create encrypt/decrypt utility (AES-256-GCM) for stored credentials
- [ ] Add `ENCRYPTION_KEY` to `.env.example`
- [ ] Mount settings routes in `app.js`
- [ ] Add "Settings" link to nav
- [ ] Create `tests/email-config.test.js`:
  - [ ] Test saving config (encrypted)
  - [ ] Test loading config (decrypted)
  - [ ] Test encryption/decryption round-trip
- [ ] Run `npm test` — all tests pass

### Step 10.2 — Email Sending Service

- [ ] Create `services/email.js` — EmailService class:
  - [ ] `constructor(workspace)` — load + decrypt config
  - [ ] `sendEmail({ to, subject, html, text, from })`
  - [ ] `sendTemplateEmail({ to, template, placeholderData })` — replace placeholders, send
  - [ ] Returns: `{ success, messageId, error }`
- [ ] Implement provider senders in `config/email-providers.js`:
  - [ ] MailgunProvider (mailgun.js)
  - [ ] GoogleProvider (nodemailer SMTP)
  - [ ] MicrosoftProvider (nodemailer SMTP)
- [ ] Add "Send Email" button on contact detail page
- [ ] Add routes:
  - [ ] GET /contacts/:id/email → compose form
  - [ ] POST /contacts/:id/email → send, log, redirect
  - [ ] GET /api/templates/:id → JSON endpoint for compose form
- [ ] Create `views/contacts/email.ejs`:
  - [ ] To: pre-filled primary email (dropdown for others)
  - [ ] Subject field
  - [ ] Body textarea
  - [ ] Template selector dropdown
  - [ ] "Send" button
- [ ] Log sent email in `communication_log` (type='email', direction='outbound')
- [ ] Update `last_contact_at` after sending
- [ ] Create `tests/email-sending.test.js`:
  - [ ] Test placeholder replacement
  - [ ] Test compose form renders
  - [ ] Test email logged in communication log
  - [ ] Test real Mailgun send (if API key set)
- [ ] Run `npm test` — all tests pass

### Step 10.3 — Email Logging Integration

- [ ] Update communication log email entries display:
  - [ ] Emails tab: date, direction, subject, from, to
  - [ ] Expandable: full body (sanitized HTML)
  - [ ] Metadata: template, campaign, provider, message ID
- [ ] Add basic email status tracking (sent/delivered/bounced)
- [ ] Update pinned notices: "Last email sent: [date] [subject]"
- [ ] Add "Resend" action on sent email entries:
  - [ ] GET /contacts/:id/email/resend/:logId → pre-fill compose
- [ ] Track email stats: `Contact.getEmailStats(contactId)` → { totalSent, lastSentDate, lastSentSubject }
- [ ] Create `tests/email-logging.test.js`:
  - [ ] Test email log entries have correct metadata
  - [ ] Test email stats calculation
  - [ ] Test pinned notice shows last email
  - [ ] Test resend pre-fills compose
- [ ] Run `npm test` — all tests pass

---

## Phase 11: Campaigns

### Step 11.1 — Campaign Model + One-Off Campaign Creation

- [ ] Add `campaigns` table to `initDb()`
- [ ] Add `campaign_recipients` table to `initDb()`
- [ ] Create `models/Campaign.js`:
  - [ ] `Campaign.create({ workspaceId, userId, name, type, templateId })`
  - [ ] `Campaign.findById(id)`
  - [ ] `Campaign.findByWorkspaceId(workspaceId, { status, type })`
  - [ ] `Campaign.update(id, fields)`
  - [ ] `Campaign.delete(id)` (draft only)
  - [ ] `Campaign.addRecipients(campaignId, contactIds)`
  - [ ] `Campaign.getRecipients(campaignId)`
  - [ ] `Campaign.updateRecipientStatus(campaignId, contactId, status, metadata)`
  - [ ] `Campaign.getStats(campaignId)` → { total, sent, pending, bounced }
- [ ] Create `routes/campaigns.js`:
  - [ ] GET /campaigns → list
  - [ ] GET /campaigns/new → create form
  - [ ] POST /campaigns → create (draft)
  - [ ] GET /campaigns/:id → detail
  - [ ] GET /campaigns/:id/edit → edit
  - [ ] POST /campaigns/:id → update
  - [ ] POST /campaigns/:id/delete → delete draft
- [ ] Create `views/campaigns/index.ejs` — list with name, type, status, stats
- [ ] Create `views/campaigns/new.ejs` — form: name, template, type
- [ ] Create `views/campaigns/detail.ejs` — template preview, recipients, stats, actions
- [ ] Mount campaign routes in `app.js`
- [ ] Add "Campaigns" link to nav
- [ ] Create `tests/campaigns.test.js`:
  - [ ] Test creating campaign
  - [ ] Test listing by workspace
  - [ ] Test detail shows correct data
  - [ ] Test delete only draft
- [ ] Run `npm test` — all tests pass

### Step 11.2 — Recipient Selection

- [ ] Add recipient selection step:
  - [ ] GET /campaigns/:id/recipients → selection page
- [ ] Create `views/campaigns/recipients.ejs`:
  - [ ] By List — select list → all contacts in that list
  - [ ] By Filter — last campaign >X days, secondary tags, last contact, has email
  - [ ] Manual — checkbox list with search
  - [ ] Exclusions — already received template, Do Not Contact
  - [ ] Dynamic recipient count display
  - [ ] "Confirm Selection" button
- [ ] Add routes:
  - [ ] GET /campaigns/:id/recipients
  - [ ] POST /campaigns/:id/recipients
  - [ ] POST /campaigns/:id/recipients/by-list
  - [ ] POST /campaigns/:id/recipients/by-filter
  - [ ] POST /campaigns/:id/recipients/manual
- [ ] Add model methods:
  - [ ] `Campaign.selectByList(campaignId, listId)`
  - [ ] `Campaign.selectByFilter(campaignId, workspaceId, filters)`
  - [ ] `Campaign.removeRecipient(campaignId, contactId)`
  - [ ] `Campaign.clearRecipients(campaignId)`
- [ ] Update `views/campaigns/detail.ejs` — show recipients, edit button, remove buttons
- [ ] Create `tests/campaign-recipients.test.js`:
  - [ ] Test selecting by list
  - [ ] Test filtering excludes Do Not Contact
  - [ ] Test manual selection
  - [ ] Test recipient count
  - [ ] Test removing recipients
- [ ] Run `npm test` — all tests pass

### Step 11.3 — Campaign Sending + Scheduled Campaigns

- [ ] Create `services/campaign-sender.js`:
  - [ ] `CampaignSender.send(campaignId)`:
    - [ ] Load campaign, template, recipients
    - [ ] Send template email to each recipient's primary email
    - [ ] Update `campaign_recipients` status per send
    - [ ] Create `communication_log` entry per send
    - [ ] Update `last_contact_at` per contact
    - [ ] Update campaign status to 'sent'
    - [ ] 200ms delay between sends (rate limiting)
    - [ ] Return `{ sent, failed, errors }`
- [ ] Add send routes:
  - [ ] POST /campaigns/:id/send → immediate send
  - [ ] POST /campaigns/:id/schedule → schedule for later
- [ ] Install `node-cron`
- [ ] Create `services/scheduler.js`:
  - [ ] Check for due scheduled campaigns every minute
  - [ ] Execute `CampaignSender.send()` when due
- [ ] Wire scheduler into `app.js` (not during tests)
- [ ] Update campaign creation UI:
  - [ ] Type selection: Immediate / Scheduled
  - [ ] Datetime picker for scheduled
- [ ] Update `views/campaigns/detail.ejs`:
  - [ ] "Send Now" button
  - [ ] "Schedule" button with datetime picker
  - [ ] Show send results after sending
- [ ] Create `tests/campaign-sending.test.js`:
  - [ ] Test sending updates recipient statuses
  - [ ] Test communication log entries created per recipient
  - [ ] Test campaign status → 'sent'
  - [ ] Test scheduled campaign status and schedule_at
  - [ ] Real email send if Mailgun configured
- [ ] Run `npm test` — all tests pass

### Step 11.4 — Drip Sequences + Loan Factory Approval Workflow

- [ ] Define drip_config JSON structure (steps with templateId, delayDays, exitConditions)
- [ ] Update campaign creation for drip type — step builder UI
- [ ] Create `views/campaigns/drip-builder.ejs`:
  - [ ] Add steps: template dropdown + delay days
  - [ ] Reorder steps
  - [ ] Remove steps
  - [ ] Exit conditions checkboxes
- [ ] Update `services/campaign-sender.js` — `processDripStep(campaignId, stepIndex)`
- [ ] Update scheduler for drip campaigns — process due steps
- [ ] Add Loan Factory approval workflow:
  - [ ] If workspace = "Loan Factory" + custom campaign → status = 'pending_approval'
  - [ ] POST /campaigns/:id/approve → approve (Andy only)
  - [ ] POST /campaigns/:id/reject → reject with reason
- [ ] Create `routes/approval.js`:
  - [ ] GET /approvals → pending campaigns list (Andy only)
  - [ ] POST /approvals/:id/approve
  - [ ] POST /approvals/:id/reject
- [ ] Create `views/campaigns/approval.ejs` — pending list with approve/reject/edit buttons
- [ ] Mount approval routes in `app.js`
- [ ] Create `tests/drip-campaigns.test.js`:
  - [ ] Test drip config saved correctly
  - [ ] Test step processing at correct delays
  - [ ] Test approval workflow: submit → pending → approve → sendable
  - [ ] Test rejection: submit → pending → reject → not sendable
  - [ ] Test only Andy can approve
- [ ] Run `npm test` — all tests pass

---

## Phase 12: Twilio SMS

### Step 12.1 — Twilio Configuration + Send SMS from Contact

- [ ] Install `twilio` SDK
- [ ] Add to `.env` and `.env.example`: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- [ ] Create `services/sms.js` — SmsService class:
  - [ ] `sendSms({ to, body, from })` → `{ success, messageSid, error }`
  - [ ] `sendTemplateSms({ to, template, placeholderData })` → strip HTML, replace placeholders
- [ ] Add "Send Text" button to contact detail page
- [ ] Create `views/contacts/sms.ejs`:
  - [ ] To: primary phone (dropdown for others)
  - [ ] Message textarea (char count, 160 limit indicator)
  - [ ] Template selector
  - [ ] "Send" button
- [ ] Add routes:
  - [ ] GET /contacts/:id/sms → compose form
  - [ ] POST /contacts/:id/sms → send, log, redirect
- [ ] Log SMS in `communication_log` (type='sms', direction='outbound')
- [ ] Update `last_contact_at` after sending
- [ ] Create `tests/sms.test.js`:
  - [ ] Test compose form renders with phone
  - [ ] Test SMS logged in communication log
  - [ ] Test `last_contact_at` updates
  - [ ] Real Twilio send if credentials set
- [ ] Run `npm test` — all tests pass

### Step 12.2 — SMS Logging + Bulk SMS

- [ ] Add "Send Bulk Text" button to `views/lists/view.ejs`
- [ ] Create `views/lists/bulk-sms.ejs`:
  - [ ] List name + recipient count
  - [ ] Message textarea + template selector
  - [ ] "Skip contacts without phone numbers" checkbox
  - [ ] Preview (first 3 recipients)
  - [ ] "Send to All" button
- [ ] Add routes:
  - [ ] GET /lists/:id/bulk-sms → compose
  - [ ] POST /lists/:id/bulk-sms → send to all with delay between sends
- [ ] Show results: sent count, failed, skipped (no phone)
- [ ] Update SMS tab in communication log:
  - [ ] Date, direction, message preview
  - [ ] Expandable: full message, phone, status
- [ ] Add "Quick Text" icon/button on contact list rows
- [ ] Create `tests/bulk-sms.test.js`:
  - [ ] Test bulk sends to all with phones
  - [ ] Test contacts without phones skipped
  - [ ] Test each send creates log entry
  - [ ] Test results show correct counts
- [ ] Run `npm test` — all tests pass

---

## Phase 13: Dashboard

### Step 13.1 — Dashboard Layout + Activity + Approvals

- [ ] Move dashboard to `routes/dashboard.js`
- [ ] Create `views/dashboard/index.ejs` with widget sections:
  - [ ] Pending Approvals (Andy only, Loan Factory campaigns)
  - [ ] Recent Activity Needing Attention:
    - [ ] Bounced emails
    - [ ] Unactioned new contacts (7 days, no communication)
    - [ ] New shared contacts
    - [ ] Stalled contacts (>30 days inactive in active lists)
  - [ ] Todos / Action Items:
    - [ ] Quick add form
    - [ ] Complete/delete per item
  - [ ] Recent Contacts / Hot Leads (last 5 added/modified)
  - [ ] Active & Upcoming Campaigns (sending/scheduled)
  - [ ] Quick Stats:
    - [ ] Total contacts
    - [ ] Contacts added this week/month
    - [ ] Emails sent this week/month
    - [ ] SMS sent this week/month
- [ ] Create `todos` table in `initDb()`
- [ ] Add todo routes in `routes/dashboard.js`:
  - [ ] POST /todos → add
  - [ ] POST /todos/:id/complete → toggle
  - [ ] POST /todos/:id/delete → delete
- [ ] Mount dashboard routes in `app.js`
- [ ] Tailwind styling: card grid, responsive
- [ ] Create `tests/dashboard.test.js`:
  - [ ] Test dashboard loads with widget data
  - [ ] Test pending approvals only for Andy
  - [ ] Test quick stats accuracy
  - [ ] Test todo CRUD
- [ ] Run `npm test` — all tests pass

### Step 13.2 — Dashboard Polish + Calendar + AI Insights Placeholder

- [ ] Add Calendar / Upcoming Events section:
  - [ ] Upcoming birthdays (next 30 days)
  - [ ] Scheduled campaigns (next 7 days)
- [ ] Add AI Insights placeholder card
- [ ] Add workspace quick-switch cards:
  - [ ] Name, contact count, active campaigns, "Open" button
- [ ] Add Smart Suggestions section (rule-based):
  - [ ] New Leads → "Enroll in welcome campaign?"
  - [ ] Inactive >60 days → "Send re-engagement?"
  - [ ] Upcoming holidays → "Schedule holiday campaign?"
  - [ ] Dismiss functionality (stored in JSON preference)
- [ ] Responsive grid: 2 columns desktop, 1 mobile
- [ ] Collapsible sections
- [ ] "Last refreshed" timestamp
- [ ] Update `tests/dashboard.test.js`:
  - [ ] Test upcoming birthdays appear
  - [ ] Test workspace cards show correct counts
  - [ ] Test smart suggestions for inactive contacts
- [ ] Run `npm test` — all tests pass

---

## Phase 14: AI Features

### Step 14.1 — AI Service Configuration + Template Generation

- [ ] Add to `.env` / `.env.example`: AI_PROVIDER, OPENAI_API_KEY, ANTHROPIC_API_KEY, AI_MODEL
- [ ] Install AI SDK (`openai` and/or `@anthropic-ai/sdk`)
- [ ] Create `services/ai.js` — AiService class:
  - [ ] `generateTemplate({ goal, audience, tone, mustHaves, context })` → { subject, preheader, body, placeholders }
  - [ ] `suggestImprovements(templateBody)` → { suggestions, improved }
  - [ ] Support OpenAI and Anthropic APIs
  - [ ] Graceful error if no API key configured
- [ ] Add "Generate with AI" button to template creation page:
  - [ ] Form/modal: Goal, Audience, Tone, Must-haves
  - [ ] Submit → POST /templates/generate → pre-fill editor
- [ ] Create `routes/ai.js`:
  - [ ] POST /templates/generate → generate template JSON
  - [ ] POST /templates/:id/improve → improvement suggestions JSON
- [ ] Create `public/js/ai-generate.js`:
  - [ ] Handle form submit → fetch → populate editor
  - [ ] Loading spinner
  - [ ] Error display
- [ ] Mount AI routes in `app.js`
- [ ] Create `tests/ai-service.test.js`:
  - [ ] Test generation returns expected structure
  - [ ] Test with real API call (if key set)
  - [ ] Test error handling (no API key)
  - [ ] Test prompt includes context
- [ ] Run `npm test` — all tests pass

### Step 14.2 — Guided Questions Wizard + Monalisa Suggestions

- [ ] Build guided questions wizard (multi-step form):
  - [ ] Step 1: Goal (options + free text)
  - [ ] Step 2: Audience (from workspace lists + custom)
  - [ ] Step 3: Tone (Professional, Friendly, Casual, Urgent, Empathetic)
  - [ ] Step 4: Must-haves (checkboxes + free text)
- [ ] Create `views/templates/ai-wizard.ejs`:
  - [ ] Progress indicator
  - [ ] Back / Next buttons per step
  - [ ] "Generate" button on final step
- [ ] Create `config/ai-prompts.js`:
  - [ ] Suggested prompts per workspace category:
    - [ ] real_estate: open house invite, just listed, market update, new buyer welcome, home anniversary, holiday
    - [ ] mortgage: rate update, pre-approval, closing follow-up
    - [ ] general: welcome, follow-up, re-engagement
- [ ] Add Monalisa's Suggested Prompts sidebar:
  - [ ] Appears for real estate workspaces
  - [ ] Click suggestion → pre-fill wizard
- [ ] Add routes:
  - [ ] GET /templates/ai-wizard → render wizard
  - [ ] POST /templates/ai-wizard → process, generate, redirect to editor
- [ ] Create `tests/ai-wizard.test.js`:
  - [ ] Test wizard renders with steps
  - [ ] Test suggested prompts for real estate workspaces
  - [ ] Test generation with wizard answers
- [ ] Run `npm test` — all tests pass

### Step 14.3 — AI Insights on Dashboard

- [ ] Update `services/ai.js`:
  - [ ] `generateInsights(userData)` → insight objects { title, body, actionUrl, priority }
  - [ ] Analyzes: template usage, campaign performance, engagement patterns
  - [ ] Cache insights (regenerate max once/day)
- [ ] Add `ai_insights_cache` table to `initDb()`
- [ ] Update dashboard route — load/generate cached insights
- [ ] Update `views/dashboard/index.ejs`:
  - [ ] Replace "AI Insights coming soon" placeholder
  - [ ] Insight cards: title, description, action link, dismiss
  - [ ] Priority styling
  - [ ] "Refresh Insights" button
- [ ] Add insight endpoints:
  - [ ] POST /ai/refresh-insights → regenerate
  - [ ] GET /ai/insights → current insights JSON
- [ ] Track template performance (times used, last used)
- [ ] Create `tests/ai-insights.test.js`:
  - [ ] Test insights generated and cached
  - [ ] Test cache expires after 24 hours
  - [ ] Test insights include relevant data
  - [ ] Test dismiss functionality
- [ ] Run `npm test` — all tests pass

---

## Phase 15: Custom Fields

### Step 15.1 — Custom Field Definitions + Rendering

- [ ] Add `custom_field_definitions` table to `initDb()`
- [ ] Add `custom_field_values` table to `initDb()`
- [ ] Create `models/CustomField.js`:
  - [ ] `CustomField.createDefinition({ workspaceId, name, fieldType, options })`
  - [ ] `CustomField.getDefinitions(workspaceId)`
  - [ ] `CustomField.updateDefinition(id, { name, options })`
  - [ ] `CustomField.deleteDefinition(id)` (cascade)
  - [ ] `CustomField.setValue(contactId, fieldId, value)`
  - [ ] `CustomField.getValues(contactId)`
  - [ ] `CustomField.getValuesByWorkspace(workspaceId, contactId)`
- [ ] Add custom field management in workspace settings:
  - [ ] GET /settings/workspace/custom-fields → manage fields
  - [ ] POST /settings/workspace/custom-fields → create
  - [ ] POST /settings/workspace/custom-fields/:id/delete → delete
- [ ] Create `views/settings/custom-fields.ejs`:
  - [ ] Field list: name, type, actions
  - [ ] Add form: name, type dropdown, options (for dropdown type)
  - [ ] Delete button per field
- [ ] Update contact forms (new, edit):
  - [ ] Render custom fields dynamically based on workspace definitions
  - [ ] Type-appropriate inputs: text, date, dropdown, number, checkbox
- [ ] Update contact detail page — "Custom Fields" section
- [ ] Update Contact model — save/load custom field values
- [ ] Create `tests/custom-fields.test.js`:
  - [ ] Test creating field definitions
  - [ ] Test setting and getting values
  - [ ] Test rendering in forms
  - [ ] Test different field types
  - [ ] Test delete definition cascades to values
- [ ] Run `npm test` — all tests pass

---

## Phase 16: Security, Backups & Deployment

### Step 16.1 — Input Validation + CSRF + API Keys

- [ ] Install `helmet`, `csurf`, `express-validator`
- [ ] Create `middleware/security.js`:
  - [ ] Helmet middleware for HTTP headers
  - [ ] CSRF middleware (exclude API routes)
  - [ ] `res.locals.csrfToken` for views
  - [ ] Rate limiting: max 5 login attempts/min/IP
- [ ] Update ALL form views — add CSRF hidden input
  - [ ] Login form
  - [ ] Contact forms (new, edit, merge)
  - [ ] Workspace forms (new, edit)
  - [ ] List forms (new, edit)
  - [ ] Template forms (new, edit, editor)
  - [ ] Campaign forms (new, edit, recipients)
  - [ ] Settings forms (email, custom fields)
  - [ ] Sharing forms
  - [ ] Import/export forms
  - [ ] SMS compose forms
  - [ ] Email compose forms
  - [ ] Note/phone call forms
  - [ ] Dashboard todo form
  - [ ] Approval forms
- [ ] Create `middleware/validation.js` — express-validator rules:
  - [ ] Contact: first_name required, email format
  - [ ] Login: username + password required
  - [ ] Workspace: name required
  - [ ] Template: name + body required
  - [ ] Sanitize all inputs (trim, escape)
- [ ] Apply validation to key POST routes
- [ ] Add `api_keys` table to `initDb()`
- [ ] Create `models/ApiKey.js`:
  - [ ] `ApiKey.generate(userId, name)` → random key, hash, store, return plain (once)
  - [ ] `ApiKey.verify(key)` → lookup, return user
  - [ ] `ApiKey.revoke(id)`
- [ ] Create `middleware/api-auth.js` — X-API-Key header check
- [ ] Create `routes/api.js`:
  - [ ] GET /api/contacts → list (API key + workspace header)
  - [ ] POST /api/contacts → create
  - [ ] GET /api/contacts/:id → detail
- [ ] Add API key management in settings:
  - [ ] GET /settings/api-keys → list, generate
  - [ ] POST /settings/api-keys → generate (show once)
  - [ ] POST /settings/api-keys/:id/revoke → revoke
- [ ] Wire security middleware into `app.js` (Helmet first, CSRF after session)
- [ ] Create `tests/security.test.js`:
  - [ ] Test: POST without CSRF token → 403
  - [ ] Test: POST with valid CSRF → success
  - [ ] Test: empty required fields → error
  - [ ] Test: XSS (script tags) → escaped
  - [ ] Test: valid API key → access
  - [ ] Test: invalid API key → 401
  - [ ] Test: rate limiting → 429
- [ ] Run `npm test` — all tests pass

### Step 16.2 — Backup System + Health Monitoring

- [ ] Create `services/backup.js`:
  - [ ] `BackupService.createBackup(targetDir)` → SQLite backup, returns { success, filePath, size }
  - [ ] `BackupService.listBackups(targetDir)` → existing backups with dates/sizes
  - [ ] `BackupService.pruneBackups(targetDir, keepCount)` → delete oldest
  - [ ] `BackupService.restoreBackup(backupPath)` → instructions (not automated)
- [ ] Add to `.env.example`: BACKUP_DIR, BACKUP_KEEP_COUNT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT
- [ ] Create `scripts/backup.sh` — cron-compatible backup script
- [ ] Add in-app backup trigger:
  - [ ] POST /settings/backup → trigger backup
  - [ ] GET /settings/backups → list backups
  - [ ] POST /settings/backup/:filename/download → download backup
- [ ] Create `views/settings/backups.ejs`:
  - [ ] "Backup Now" button
  - [ ] Backup list: filename, date, size, download link
  - [ ] Retention setting
  - [ ] Backup status / last backup date
- [ ] Create `services/health.js`:
  - [ ] `HealthService.check()` → database status, disk space, last backup, alerts
  - [ ] `HealthService.getAlerts()` → warnings (backup >48hrs old, etc.)
- [ ] Add GET /api/health endpoint (no auth required)
- [ ] Add health indicator to dashboard (green/yellow/red)
- [ ] Create `tests/backup.test.js`:
  - [ ] Test backup creates a file
  - [ ] Test backup is valid SQLite
  - [ ] Test prune keeps correct count
  - [ ] Test health check returns status
- [ ] Run `npm test` — all tests pass

### Step 16.3 — Deployment Configuration

- [ ] Create `config/production.js`:
  - [ ] Trust proxy
  - [ ] Secure cookies
  - [ ] Production session settings
  - [ ] Logging config
- [ ] Update `app.js` for production:
  - [ ] Trust proxy when NODE_ENV=production
  - [ ] Secure cookies
  - [ ] Disable detailed errors
  - [ ] Install and enable `compression` middleware
- [ ] Create `scripts/deploy.sh`:
  - [ ] `npm ci --production`
  - [ ] Run database init
  - [ ] Seed default data
  - [ ] Setup backup cron
  - [ ] Start with PM2
- [ ] Create `ecosystem.config.js` for PM2
- [ ] Create `docs/deployment-guide.md`:
  - [ ] Prerequisites
  - [ ] Installation steps
  - [ ] Environment configuration
  - [ ] PM2 setup
  - [ ] HTTPS options (Let's Encrypt, self-signed, Cloudflare Tunnel)
  - [ ] Firewall (ufw)
  - [ ] Backup cron
  - [ ] Monitoring / health checks
  - [ ] Troubleshooting
- [ ] Create `.env.production.example`
- [ ] Add `"start:prod"` script to package.json
- [ ] Add basic request logging (file in production, console in dev)
- [ ] Create `tests/production.test.js`:
  - [ ] Test app starts in production mode
  - [ ] Test compression enabled
  - [ ] Test health endpoint
  - [ ] Test static assets served
- [ ] Run `npm test` — all tests pass

---

## Final Integration Verification

- [ ] Start app: `npm start`
- [ ] Login as Andy
- [ ] Dashboard shows all widgets with real data
- [ ] Switch to "Loan Factory" workspace
- [ ] Create contact with all fields, secondary emails/phones
- [ ] Assign to "Leads" list
- [ ] View contact detail — pinned notices, communication log
- [ ] Send email via template — logged
- [ ] Send SMS — logged
- [ ] Add manual note — appears in log
- [ ] Change stage Leads → Prospects — auto-logged
- [ ] Share contact with Monalisa
- [ ] Create template via AI wizard
- [ ] Create campaign → select template → select recipients → send
- [ ] Dashboard shows sent campaign
- [ ] Export contacts → CSV downloads correctly
- [ ] Import CSV → contacts created with correct mapping
- [ ] Settings: manage custom fields, email config, API keys
- [ ] Trigger backup → verify file created
- [ ] Logout
- [ ] Login as Monalisa
- [ ] "Shared with Me" → see Andy's shared contact (read-only)
- [ ] "Save As" → copy to own workspace
- [ ] Create contacts and templates in own workspace
- [ ] Submit campaign in Loan Factory → pending approval
- [ ] Logout → login as Andy → approve campaign
- [ ] Check `/api/health` → returns OK
- [ ] Run `npm test` → **all tests pass**

---

## Summary

| Phase | Steps | Items | Status |
|-------|-------|-------|--------|
| 1. Foundation | 1.1–1.2 | 25 | |
| 2. Authentication | 2.1–2.3 | 42 | |
| 3. Workspaces | 3.1–3.3 | 38 | |
| 4. Contacts | 4.1–4.4 | 60 | |
| 5. Contact Lists | 5.1–5.3 | 38 | |
| 6. Comm Log & Notes | 6.1–6.2 | 26 | |
| 7. Sharing | 7.1–7.2 | 22 | |
| 8. Templates | 8.1–8.3 | 36 | |
| 9. CSV Import/Export | 9.1–9.2 | 30 | |
| 10. Email Integration | 10.1–10.3 | 32 | |
| 11. Campaigns | 11.1–11.4 | 54 | |
| 12. Twilio SMS | 12.1–12.2 | 22 | |
| 13. Dashboard | 13.1–13.2 | 28 | |
| 14. AI Features | 14.1–14.3 | 32 | |
| 15. Custom Fields | 15.1 | 14 | |
| 16. Security/Deploy | 16.1–16.3 | 50 | |
| **Final Verification** | — | 27 | |
| **Total** | **43 steps** | **~576 items** | |
