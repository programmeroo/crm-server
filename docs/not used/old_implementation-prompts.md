# Pi-CRM Implementation Prompts

> Each prompt below is designed to be fed to a code-generation LLM in sequence.
> Every prompt builds on the previous steps and ends with wiring into the running app.
> Tests use real SQLite databases — no mocks. API integrations use real calls.
> Each prompt is enclosed in code tags for easy copy-paste.

---

## Phase 1: Foundation Refactor

### Step 1.1 — Environment Config + Project Restructure + Test Framework

**Context:** The project currently has a flat structure with `server.js` containing all logic, inline SQLite setup, and hardcoded values. We need to restructure for scalability and add a test framework before building any new features.

```text
You are working on the pi-crm project — a Node.js + Express + SQLite + EJS application.

CURRENT STATE:
- server.js contains everything: Express setup, SQLite database init, all routes, inline SQL
- Views are in views/ with partials/ (header.ejs, footer.ejs)
- Database is at data/crm.db with a single "contacts" table (id, name, email, last_contact)
- Dependencies: express@5, better-sqlite3, ejs
- No .env file, no test framework, no project structure beyond flat files

TASK — Restructure the project foundation:

1. Create a `.env` file and `.env.example` with:
   - PORT=3000
   - DATABASE_PATH=./data/crm.db
   - SESSION_SECRET=change-me-in-production
   - NODE_ENV=development

2. Install dependencies:
   - dotenv (for env vars)
   - jest and supertest (for testing)
   - Add "test" script to package.json: "jest --verbose --forceExit"
   - Add "start" script: "node server.js"
   - Add "dev" script: "node --watch server.js"

3. Create these directories (empty for now, will be populated in later steps):
   - config/
   - middleware/
   - models/
   - routes/
   - services/
   - tests/
   - scripts/
   - public/css/
   - public/js/

4. Create config/database.js:
   - Require dotenv/config at the top
   - Export a function getDb() that creates/returns a singleton better-sqlite3 connection
   - Use DATABASE_PATH from process.env
   - Enable WAL mode on connection
   - Export a closeDb() function for clean shutdown

5. Update server.js:
   - Use dotenv at the top
   - Use PORT from process.env
   - Import getDb from config/database.js instead of inline database setup
   - Keep all existing routes working exactly as before
   - The contacts table creation should move to config/database.js as an initDb() function

6. Create tests/setup.js:
   - Set NODE_ENV=test
   - Set DATABASE_PATH to a test-specific path: ./data/test-crm.db
   - Export a helper that resets the test database before each test suite

7. Create tests/smoke.test.js:
   - Test that the app starts and GET / returns 200
   - Test that GET /contacts returns 200
   - Test that POST /contacts/add creates a contact and redirects
   - Use supertest with the Express app
   - Use a REAL SQLite database (the test db), not mocks

8. Update .gitignore to include:
   - data/test-*.db (test databases)

IMPORTANT:
- Do NOT change any existing route behavior or view rendering
- All existing functionality must continue to work identically
- Verify by running the test suite: npm test
- The app should still work with: npm start
```

---

### Step 1.2 — Separate app.js from server.js

**Context:** To make the Express app testable with supertest, we need to separate the app configuration from the server listener.

```text
You are working on the pi-crm project. Step 1.1 is complete: we have dotenv, config/database.js,
jest+supertest installed, and tests/smoke.test.js.

CURRENT STATE:
- server.js creates the Express app AND starts listening on the port
- config/database.js exports getDb(), closeDb(), and initDb()
- tests/ directory exists with setup.js and smoke.test.js

TASK — Separate app creation from server startup:

1. Create app.js in the project root:
   - Move ALL Express configuration from server.js into app.js:
     - Express app creation
     - View engine setup
     - Middleware (urlencoded, static)
     - ALL route handlers
   - Call initDb() to ensure tables exist
   - Export the app (module.exports = app)
   - Do NOT call app.listen() in app.js

2. Simplify server.js to:
   - Import app from ./app.js
   - Import PORT from process.env (with dotenv)
   - Call app.listen(PORT) with a console log
   - That's it — server.js is just the entry point

3. Update tests/smoke.test.js:
   - Import app from ../app.js (not server.js)
   - Use supertest(app) for all requests
   - In beforeAll: ensure the test database is clean (delete and recreate)
   - In afterAll: call closeDb()
   - Tests:
     a. GET / → 200, body contains "Pi-CRM"
     b. GET /contacts → 200
     c. POST /contacts/add with {name: "Test User", email: "test@example.com"} → redirects to /contacts
     d. GET /contacts after add → body contains "Test User"
     e. POST /contacts/delete/:id → redirects, contact is gone

4. Add jest config to package.json:
   "jest": {
     "testEnvironment": "node",
     "setupFiles": ["./tests/setup.js"]
   }

VERIFY:
- npm start → app works at http://localhost:3000
- npm test → all tests pass using a real test SQLite database
- All existing routes behave identically
```

---

## Phase 2: Authentication

### Step 2.1 — User Model + Password Hashing + Seed Script

**Context:** The app currently has no concept of users. We need a users table, a User model with bcrypt password hashing, and a seed script to create Andy and Monalisa.

```text
You are working on the pi-crm project. Steps 1.1–1.2 are complete: we have a structured project
with app.js, config/database.js, dotenv, and a working test suite.

CURRENT STATE:
- Database has only a "contacts" table
- No user concept exists
- config/database.js handles DB connection + table creation via initDb()

TASK — Add users table, User model, and seed script:

1. Update config/database.js initDb() to also create the users table:
   CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT UNIQUE NOT NULL,
     password_hash TEXT NOT NULL,
     display_name TEXT NOT NULL,
     email TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now'))
   );

2. Install bcrypt: npm install bcrypt

3. Create models/User.js:
   - getDb() from config/database.js
   - Methods (all using real SQL, no ORM):
     - User.create({ username, password, displayName, email }) → hashes password with bcrypt (10 rounds), inserts, returns user object (without password_hash)
     - User.findByUsername(username) → returns user row or null
     - User.findById(id) → returns user row (without password_hash) or null
     - User.verifyPassword(plaintext, hash) → bcrypt.compare, returns boolean
     - User.getAll() → returns all users (without password_hash)

4. Create scripts/seed.js:
   - Imports User model and initDb
   - Creates two users (skip if already exist):
     - username: "andy", displayName: "Andy", password: "changeme123"
     - username: "monalisa", displayName: "Monalisa", password: "changeme123"
   - Console logs what was created
   - Add to package.json scripts: "seed": "node scripts/seed.js"

5. Create tests/user.test.js:
   - Test User.create() creates a user with hashed password
   - Test User.findByUsername() returns the user
   - Test User.verifyPassword() returns true for correct password, false for wrong
   - Test User.create() with duplicate username throws an error
   - Use the REAL test database, not mocks

6. Update .env.example to add: BCRYPT_ROUNDS=10

VERIFY:
- npm run seed → creates Andy and Monalisa in the database
- npm test → all tests pass (existing + new user tests)
- No changes to existing routes or views
```

---

### Step 2.2 — Login/Logout Routes + Session Management + Login View

**Context:** We have a User model with bcrypt. Now we need session-based authentication with login/logout pages.

```text
You are working on the pi-crm project. Step 2.1 is complete: we have a User model with bcrypt
password hashing and Andy + Monalisa seeded in the database.

TASK — Add login/logout with session management:

1. Install dependencies:
   - express-session
   - better-sqlite3-session-store (for persistent sessions in SQLite)
   - connect-flash (for flash messages)

2. Create config/session.js:
   - Configure express-session with:
     - better-sqlite3-session-store using the same database
     - Secret from SESSION_SECRET env var
     - Resave: false, saveUninitialized: false
     - Cookie: { maxAge: 7 days, httpOnly: true, secure: false for dev }
   - Export the session middleware

3. Update config/database.js initDb() to create the sessions table:
   CREATE TABLE IF NOT EXISTS sessions (
     sid TEXT PRIMARY KEY,
     sess TEXT NOT NULL,
     expired TEXT NOT NULL
   );

4. Create routes/auth.js:
   - GET /login → render auth/login.ejs (if already logged in, redirect to /)
   - POST /login → validate credentials with User model:
     - On success: set req.session.userId, flash success, redirect to /
     - On failure: flash error "Invalid username or password", redirect to /login
   - POST /logout → destroy session, redirect to /login

5. Create views/auth/login.ejs:
   - Clean login form with Tailwind CSS styling
   - Fields: username, password
   - Submit button
   - Display flash messages (errors/success)
   - Pi-CRM branding

6. Create views/partials/flash-messages.ejs:
   - Partial that renders flash messages (success: green, error: red)
   - Auto-dismiss after 5 seconds (simple JS)

7. Wire into app.js:
   - Add session middleware (from config/session.js)
   - Add connect-flash middleware
   - Mount auth routes: app.use('/', authRoutes)
   - Add res.locals.user = null for now (will be populated by auth middleware in next step)
   - Include flash-messages partial in header.ejs

8. Update views/partials/header.ejs:
   - Include flash-messages partial
   - Show logged-in user's display name in the nav (if available via res.locals.user)

VERIFY:
- npm start → visit /login, see the login form
- Login with "andy" / "changeme123" → redirects to dashboard
- Login with wrong password → shows error flash message
- POST /logout → redirects to /login
- npm test → existing tests still pass (sessions don't interfere)
```

---

### Step 2.3 — Auth Middleware + Route Protection

**Context:** Login/logout works but all routes are still accessible without authentication. We need middleware to protect routes and a test for auth flow.

```text
You are working on the pi-crm project. Step 2.2 is complete: we have login/logout routes,
sessions stored in SQLite, and flash messages.

TASK — Protect all routes with authentication middleware:

1. Create middleware/auth.js:
   - requireAuth(req, res, next):
     - If req.session.userId exists, look up user with User.findById()
     - Set req.user and res.locals.user to the user object
     - Call next()
     - If no session or user not found: redirect to /login with flash "Please log in"
   - guestOnly(req, res, next):
     - If req.session.userId exists, redirect to /
     - Otherwise, call next()

2. Update app.js:
   - Apply guestOnly middleware to GET /login and POST /login
   - Apply requireAuth middleware to ALL other routes (except static assets)
   - Use app.use(requireAuth) AFTER auth routes are mounted

3. Update views/partials/header.ejs:
   - Show user.display_name in the nav bar
   - Show Logout button (POST form to /logout)
   - Only show navigation links when user is logged in

4. Move existing contact routes into routes/contacts.js:
   - Extract all /contacts/* handlers from app.js into routes/contacts.js
   - Mount in app.js: app.use('/contacts', requireAuth, contactRoutes)
   - Keep the dashboard route (GET /) in app.js for now

5. Create tests/auth.test.js:
   - Test GET / without session → redirects to /login
   - Test GET /contacts without session → redirects to /login
   - Test POST /login with valid creds → sets session, redirects to /
   - Test POST /login with invalid creds → stays on /login
   - Test POST /logout → clears session
   - Test GET / with valid session → 200
   - Seed a test user in beforeAll, use REAL database

VERIFY:
- npm start → visiting / redirects to /login
- After login → can access all routes, see user name in nav
- Logout → redirected to login, can't access routes
- npm test → all tests pass
```

---

## Phase 3: Workspaces

### Step 3.1 — Workspace Model + CRUD Routes + Views

**Context:** Authentication is complete. Now we need workspaces — the top-level organizational containers. Each user has their own isolated workspaces.

```text
You are working on the pi-crm project. Phase 2 is complete: we have user authentication with
session management, route protection, and login/logout.

TASK — Add workspace model with CRUD:

1. Update config/database.js initDb() to create the workspaces table:
   CREATE TABLE IF NOT EXISTS workspaces (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     description TEXT,
     email_provider TEXT,
     email_config TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (user_id) REFERENCES users(id)
   );

2. Create models/Workspace.js:
   - Workspace.create({ userId, name, description }) → insert and return workspace
   - Workspace.findById(id) → return workspace or null
   - Workspace.findByUserId(userId) → return all workspaces for a user
   - Workspace.update(id, { name, description }) → update and return
   - Workspace.delete(id) → delete workspace
   - All methods use real SQL via getDb()

3. Create routes/workspaces.js:
   - GET /workspaces → list user's workspaces (views/workspaces/index.ejs)
   - GET /workspaces/new → show create form (views/workspaces/new.ejs)
   - POST /workspaces → create workspace, redirect to /workspaces
   - GET /workspaces/:id/edit → show edit form (views/workspaces/edit.ejs)
   - POST /workspaces/:id → update workspace, redirect to /workspaces
   - POST /workspaces/:id/delete → delete workspace, redirect to /workspaces
   - ALL routes scoped to req.user.id — users can only see/edit their own workspaces

4. Create views:
   - views/workspaces/index.ejs — card grid of workspaces with name, description, contact count, edit/delete links
   - views/workspaces/new.ejs — form with name (required), description (optional)
   - views/workspaces/edit.ejs — pre-filled edit form

5. Mount in app.js:
   - app.use('/workspaces', requireAuth, workspaceRoutes)

6. Update header.ejs nav:
   - Add "Workspaces" link

7. Create tests/workspaces.test.js:
   - Test creating a workspace
   - Test listing only own workspaces (create workspaces for two users, verify isolation)
   - Test editing a workspace
   - Test deleting a workspace
   - Test that user A cannot access user B's workspace
   - Use REAL test database with seeded users

VERIFY:
- npm start → login → navigate to /workspaces → create, edit, delete workspaces
- Workspaces are isolated between Andy and Monalisa
- npm test → all tests pass
```

---

### Step 3.2 — Workspace Switcher + Scoping Middleware

**Context:** Workspaces exist but there's no way to "enter" a workspace and see workspace-scoped data. We need a workspace switcher and middleware that sets the active workspace.

```text
You are working on the pi-crm project. Step 3.1 is complete: workspace CRUD is working
with user isolation.

TASK — Add workspace selection and scoping:

1. Create middleware/workspace.js:
   - loadWorkspace(req, res, next):
     - Check req.session.activeWorkspaceId
     - If set, verify workspace exists AND belongs to req.user.id
     - Set req.workspace and res.locals.workspace to the workspace object
     - If no active workspace or invalid, set req.workspace = null
     - Call next()
   - requireWorkspace(req, res, next):
     - If req.workspace exists, call next()
     - Otherwise flash "Please select a workspace" and redirect to /workspaces

2. Update app.js:
   - Add loadWorkspace middleware AFTER requireAuth (for all authenticated routes)
   - Contacts routes should use requireWorkspace middleware

3. Add workspace activation route in routes/workspaces.js:
   - POST /workspaces/:id/activate → set req.session.activeWorkspaceId = id, redirect to /
   - Only allow activating own workspaces

4. Create views/partials/workspace-switcher.ejs:
   - Dropdown in the nav bar showing the active workspace name
   - Dropdown list of user's workspaces with activate buttons
   - "Manage Workspaces" link at bottom
   - If no workspace selected, show "Select Workspace" prompt

5. Update views/partials/header.ejs:
   - Include workspace-switcher partial in the nav bar
   - Show active workspace name prominently

6. Update the dashboard route (GET /):
   - If workspace is selected: show workspace-specific dashboard (contact count for that workspace)
   - If no workspace selected: show "Select a workspace to get started" with link to /workspaces

7. Update routes/contacts.js:
   - All contact queries should filter by req.workspace.id
   - Creating a contact should set workspace_id = req.workspace.id
   - Note: The contacts table doesn't have workspace_id yet — that comes in Phase 4.
     For now, just pass req.workspace to views for display context.

VERIFY:
- npm start → login → see workspace switcher in nav
- Select a workspace → name shows in nav, dashboard updates
- Switch workspaces → context updates
- No workspace selected → prompted to select one
- npm test → all tests pass
```

---

### Step 3.3 — Seed Default Workspaces + Integration Tests

**Context:** Workspace switching works. Let's seed the default workspaces from the spec and add comprehensive tests.

```text
You are working on the pi-crm project. Step 3.2 is complete: workspace selection and scoping
middleware are working.

TASK — Seed default workspaces and add integration tests:

1. Update scripts/seed.js to create default workspaces:
   For Andy:
   - Loan Factory
   - MaiStory
   - RateReady Realtors
   - Real Estate Open Houses
   - AI Consulting
   - Family & Friends

   For Monalisa:
   - Coldwell Banker Contacts
   - Real Estate Open Houses
   - Family & Friends

   Skip creation if workspaces already exist for that user.

2. Update tests/workspaces.test.js with integration tests:
   - Test workspace activation sets session
   - Test workspace switcher only shows own workspaces
   - Test accessing routes with requireWorkspace without active workspace → redirect
   - Test workspace scoping: activating workspace A, then checking context shows workspace A
   - All tests use REAL test database

3. Ensure the seed script is idempotent — running it multiple times doesn't create duplicates.

VERIFY:
- npm run seed → creates users AND their default workspaces
- npm start → login as Andy → see 6 workspaces → select one → nav shows it
- Login as Monalisa → see 3 different workspaces
- npm test → all tests pass
```

---

## Phase 4: Contact Model Overhaul

### Step 4.1 — New Contacts Schema + Data Migration

**Context:** The current contacts table only has (id, name, email, last_contact). The spec requires a much richer schema with workspace scoping and many more fields.

```text
You are working on the pi-crm project. Phase 3 is complete: we have users, authentication,
workspaces with isolation, workspace switching, and seeded data.

CURRENT contacts table: id, name, email, last_contact
TARGET: Full contact schema with workspace_id, first/last name, company, birthday, etc.

TASK — Migrate contacts to the new schema:

1. Update config/database.js initDb() to create the new contacts table:
   CREATE TABLE IF NOT EXISTS contacts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     workspace_id INTEGER NOT NULL,
     primary_list_id INTEGER,
     first_name TEXT NOT NULL,
     last_name TEXT,
     company TEXT,
     birthday TEXT,
     marital_status TEXT,
     spouse_contact_id INTEGER,
     children_names TEXT,
     pet_names TEXT,
     referred_by TEXT,
     transaction_notes TEXT,
     notes TEXT,
     do_not_contact INTEGER DEFAULT 0,
     shared_with_user_id INTEGER,
     last_contact_at TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
     FOREIGN KEY (primary_list_id) REFERENCES contact_lists(id),
     FOREIGN KEY (spouse_contact_id) REFERENCES contacts(id),
     FOREIGN KEY (shared_with_user_id) REFERENCES users(id)
   );

2. Handle migration of existing data:
   - In initDb(), check if the OLD contacts table exists (has 'name' column but no 'workspace_id')
   - If so, create the new table as contacts_new, migrate data:
     - Split "name" into first_name (first word) and last_name (remaining)
     - Set workspace_id to the first workspace of user Andy (or 1 as fallback)
     - Copy email → will be handled in step 4.2 (contact_emails table)
     - Copy last_contact → last_contact_at
   - Rename old table to contacts_old, rename contacts_new to contacts
   - Drop contacts_old after verification

3. Create models/Contact.js:
   - Contact.create({ workspaceId, firstName, lastName, company, ... }) → insert, return contact
   - Contact.findById(id) → return contact or null
   - Contact.findByWorkspaceId(workspaceId, { search, sortBy, limit, offset }) → paginated list
   - Contact.update(id, fields) → update, return contact
   - Contact.delete(id) → delete
   - Contact.count(workspaceId) → count contacts in workspace
   - All methods use real SQL

4. Update routes/contacts.js to use the new Contact model:
   - All routes filter by req.workspace.id
   - GET /contacts → list contacts in active workspace
   - POST /contacts/add → create with workspace_id, first_name, last_name, etc.
   - Update edit/delete to use new schema
   - Add requireWorkspace middleware to all contact routes

5. Update views/contacts/index.ejs (was contacts.ejs):
   - Move to views/contacts/index.ejs
   - Update the add form: first name, last name, company, email, phone (basic for now)
   - Update the table to show first name, last name, company, primary email, last contact
   - Note: emails/phones are just text fields for now, proper multi-email comes in step 4.2

6. Create tests/contacts.test.js:
   - Test creating a contact in a workspace
   - Test listing contacts only in the active workspace
   - Test contact isolation between workspaces
   - Test updating and deleting contacts
   - Test search/filter functionality
   - Use REAL test database with seeded users and workspaces

VERIFY:
- npm run seed → seeds users + workspaces, any existing contacts are migrated
- npm start → login → select workspace → create contacts with new fields
- Contacts are scoped to active workspace
- npm test → all tests pass
```

---

### Step 4.2 — Contact Emails & Phones Tables

**Context:** Contacts need multiple emails and phones with primary/secondary designation and labels.

```text
You are working on the pi-crm project. Step 4.1 is complete: contacts have the full schema
and are workspace-scoped.

TASK — Add multi-email and multi-phone support:

1. Update config/database.js initDb() to create:
   CREATE TABLE IF NOT EXISTS contact_emails (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     contact_id INTEGER NOT NULL,
     email TEXT NOT NULL,
     is_primary INTEGER DEFAULT 0,
     label TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
   );

   CREATE TABLE IF NOT EXISTS contact_phones (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     contact_id INTEGER NOT NULL,
     phone TEXT NOT NULL,
     is_primary INTEGER DEFAULT 0,
     label TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
   );

2. Create models/ContactEmail.js:
   - ContactEmail.create({ contactId, email, isPrimary, label })
   - ContactEmail.findByContactId(contactId) → returns all emails for a contact
   - ContactEmail.getPrimary(contactId) → returns primary email or null
   - ContactEmail.setPrimary(contactId, emailId) → sets one as primary, unsets others
   - ContactEmail.delete(id)

3. Create models/ContactPhone.js:
   - ContactPhone.create({ contactId, phone, isPrimary, label })
   - ContactPhone.findByContactId(contactId) → returns all phones for a contact
   - ContactPhone.getPrimary(contactId) → returns primary phone or null
   - ContactPhone.setPrimary(contactId, phoneId) → sets one as primary, unsets others
   - ContactPhone.delete(id)

4. Update Contact.create() in models/Contact.js:
   - Accept email and phone parameters
   - After creating the contact, create the primary email and phone records
   - Return contact with primary email and phone attached

5. Update Contact.findByWorkspaceId():
   - Join with contact_emails (primary) and contact_phones (primary) to include in list results
   - Return: { ...contact, primaryEmail, primaryPhone }

6. Update views/contacts/index.ejs:
   - Show primary email and primary phone in the contact list table
   - Add form: include email and phone fields

7. Create tests/contact-emails-phones.test.js:
   - Test creating contact with email and phone
   - Test adding secondary emails
   - Test promoting a secondary email to primary
   - Test deleting an email
   - Test that deleting a contact cascades to emails/phones
   - Use REAL test database

VERIFY:
- npm start → create contact with email/phone → shows in list
- Contacts display primary email and primary phone
- npm test → all tests pass
```

---

### Step 4.3 — Contact CRUD Views (Workspace-Scoped)

**Context:** The contact model supports all fields and multi-email/phone. Now we need proper create, edit, and list views.

```text
You are working on the pi-crm project. Step 4.2 is complete: contacts have multi-email
and multi-phone support with primary/secondary designation.

TASK — Build full contact CRUD views:

1. Create views/contacts/new.ejs:
   - Full form with all contact fields organized in sections:
     - Basic Info: first name*, last name, company
     - Contact Info: primary email, primary phone (with label dropdown)
     - Personal: birthday (date picker), marital status, children's names, pet names
     - Business: referred by, company
     - Notes: transaction/loan file notes, general notes (textarea)
   - Tailwind CSS styling with clean layout
   - Submit button → POST /contacts

2. Update routes/contacts.js:
   - GET /contacts/new → render views/contacts/new.ejs
   - POST /contacts → handle full form submission, create contact + email + phone
   - GET /contacts/:id/edit → render views/contacts/edit.ejs with all data pre-filled
   - POST /contacts/:id → update contact fields
   - Validate that the contact belongs to the active workspace before edit/delete

3. Create views/contacts/edit.ejs:
   - Same layout as new.ejs but pre-filled with contact data
   - Section for managing emails: list existing, add new, set primary, delete
   - Section for managing phones: list existing, add new, set primary, delete
   - Use simple forms that POST to specific endpoints:
     - POST /contacts/:id/emails/add
     - POST /contacts/:id/emails/:emailId/set-primary
     - POST /contacts/:id/emails/:emailId/delete
     - Same pattern for phones

4. Add email/phone management routes in routes/contacts.js:
   - POST /contacts/:id/emails/add → add secondary email
   - POST /contacts/:id/emails/:emailId/set-primary → set as primary
   - POST /contacts/:id/emails/:emailId/delete → delete (cannot delete last primary)
   - Same routes for phones
   - All redirect back to GET /contacts/:id/edit

5. Update views/contacts/index.ejs:
   - Add "New Contact" button linking to /contacts/new
   - Each row has Edit and Delete action links
   - Show first name, last name, company, primary email, primary phone, last contact date
   - Add search box that filters by name/email/company (query param ?search=)

6. Add search to Contact.findByWorkspaceId():
   - Accept search parameter
   - Filter by first_name, last_name, company, or email LIKE '%search%'

VERIFY:
- npm start → create a contact with all fields filled → appears in list
- Edit contact → all fields pre-filled, can modify
- Add/remove secondary emails and phones
- Search contacts by name or email
- npm test → all tests pass
```

---

### Step 4.4 — Contact Detail Page + Duplicate Detection

**Context:** Contacts have full CRUD. Now we need a rich detail page and duplicate detection when adding new contacts.

```text
You are working on the pi-crm project. Step 4.3 is complete: full contact CRUD with
multi-email/phone management and search.

TASK — Add contact detail page and duplicate detection:

1. Create views/contacts/detail.ejs:
   - Top section: pinned notices area (placeholder for now, will be populated later)
   - Contact header: full name, company, primary email, primary phone
   - Info sections (collapsible with Tailwind):
     - Contact Info: all emails (with labels, primary badge), all phones (with labels, primary badge)
     - Personal: birthday, marital status, spouse, children, pets
     - Business: company, referred by
     - Transaction / Loan File Notes: rendered with clickable links
     - Notes: general notes with timestamps
   - Communication Log section: placeholder "Communication log will appear here" (implemented in Phase 6)
   - Action buttons: Edit, Delete, Share (placeholder)
   - Lists section: shows primary list + secondary lists (placeholder, implemented in Phase 5)

2. Add route in routes/contacts.js:
   - GET /contacts/:id → render views/contacts/detail.ejs
   - Fetch contact with all emails, phones
   - Verify contact belongs to active workspace

3. Update views/contacts/index.ejs:
   - Contact name in list is now a link to /contacts/:id (detail page)

4. Create services/duplicate-detector.js:
   - DuplicateDetector.check(workspaceId, { emails, phones }) →
     - Query contacts in workspace where any email matches OR any phone matches
     - Return array of potential duplicates with match reason
   - Used during contact creation to warn about duplicates

5. Update POST /contacts route:
   - Before creating, run duplicate detection
   - If duplicates found, redirect to /contacts/merge?newData=...&duplicateIds=...
   - If no duplicates, create normally

6. Create views/contacts/merge.ejs:
   - Side-by-side comparison: new data vs existing contact(s)
   - Per-field selector: choose which value to keep (radio buttons)
   - Options: Merge (combine into existing), Keep Separate (create anyway), Cancel
   - POST /contacts/merge → handle the chosen action

7. Add merge routes in routes/contacts.js:
   - GET /contacts/merge → show merge view with comparison data
   - POST /contacts/merge → execute merge or create separate

8. Create tests/duplicate-detection.test.js:
   - Test: adding contact with same email → detected as duplicate
   - Test: adding contact with same phone → detected as duplicate
   - Test: adding contact with no matches → no duplicates
   - Test: merge combines fields correctly
   - Test: "keep separate" creates new contact despite duplicate
   - Use REAL test database

VERIFY:
- npm start → click contact name → see detail page with all info
- Create contact with email that already exists → duplicate warning shown
- Merge view shows side-by-side comparison, can merge or keep separate
- npm test → all tests pass
```

---

## Phase 5: Contact Lists

### Step 5.1 — Contact Lists Model + CRUD + Views

**Context:** We need the list system — primary list (pipeline stage) and secondary lists (tags). Lists are per-workspace.

```text
You are working on the pi-crm project. Phase 4 is complete: contacts have the full schema,
multi-email/phone, detail page, and duplicate detection.

TASK — Add contact lists (pipeline stages + tag lists):

1. Update config/database.js initDb() to create:
   CREATE TABLE IF NOT EXISTS contact_lists (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     workspace_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     description TEXT,
     is_default INTEGER DEFAULT 0,
     sort_order INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
   );

   CREATE TABLE IF NOT EXISTS contact_list_assignments (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     contact_id INTEGER NOT NULL,
     list_id INTEGER NOT NULL,
     assigned_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
     FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE,
     UNIQUE(contact_id, list_id)
   );

2. Create models/ContactList.js:
   - ContactList.create({ workspaceId, name, description, isDefault }) → insert, return list
   - ContactList.findByWorkspaceId(workspaceId) → return all lists for workspace
   - ContactList.findById(id) → return list or null
   - ContactList.update(id, { name, description }) → update
   - ContactList.delete(id) → delete (fail if contacts still assigned as primary)
   - ContactList.getContactCount(listId) → count contacts with this as primary list
   - ContactList.assignContact(contactId, listId) → add secondary list assignment
   - ContactList.unassignContact(contactId, listId) → remove assignment
   - ContactList.getSecondaryLists(contactId) → return secondary lists for a contact

3. Create routes/lists.js:
   - GET /lists → list all lists in active workspace with contact counts
   - GET /lists/new → show create form
   - POST /lists → create list
   - GET /lists/:id/edit → edit form
   - POST /lists/:id → update list
   - POST /lists/:id/delete → delete list (only if empty or reassign contacts first)
   - GET /lists/:id → show contacts in this list (filtered view)

4. Create views:
   - views/lists/index.ejs — list of all lists with names, descriptions, contact counts
   - views/lists/new.ejs — create form (name, description)
   - views/lists/edit.ejs — edit form
   - views/lists/view.ejs — contacts filtered to this list (reuse contact table layout)

5. Mount in app.js:
   - app.use('/lists', requireAuth, requireWorkspace, listRoutes)

6. Update header.ejs nav:
   - Add "Lists" link (only shows when workspace is active)

7. Update scripts/seed.js:
   - For each Loan Factory workspace, create default lists:
     Leads, Prospects, Applications, Closed, Lost
   - For other workspaces: Contacts, Active, Inactive

8. Create tests/lists.test.js:
   - Test creating a list
   - Test listing only workspace's lists
   - Test deleting empty list succeeds
   - Test deleting list with contacts fails or reassigns
   - Use REAL test database

VERIFY:
- npm run seed → creates default lists per workspace
- npm start → Lists page shows lists with counts
- Create, edit, delete lists
- Click a list → see contacts in that list
- npm test → all tests pass
```

---

### Step 5.2 — Primary List Assignment + Secondary Tags + UI

**Context:** Lists exist. Now contacts need primary list assignment (pipeline stage) and secondary list tagging.

```text
You are working on the pi-crm project. Step 5.1 is complete: contact lists with CRUD are working.

TASK — Wire contacts to lists (primary + secondary):

1. Update views/contacts/new.ejs:
   - Add "Primary List" dropdown (required) — populated from workspace's lists
   - Add "Secondary Lists" multi-select checkboxes — optional tags

2. Update views/contacts/edit.ejs:
   - Add "Primary List" dropdown (shows current, allows changing)
   - Add "Secondary Lists" checkboxes (shows current assignments)

3. Update POST /contacts (create):
   - Accept primaryListId from form
   - Set contact.primary_list_id = primaryListId
   - Accept secondaryListIds[] from form
   - Create contact_list_assignments for each secondary list

4. Update POST /contacts/:id (update):
   - If primaryListId changed, update contact.primary_list_id
   - Sync secondary list assignments (remove old, add new)

5. Update views/contacts/detail.ejs:
   - Show primary list name as a badge/tag (with link to list view)
   - Show secondary lists as smaller tags
   - Quick "Change Stage" dropdown that updates primary list inline

6. Update views/contacts/index.ejs:
   - Show primary list name for each contact in the table
   - Add filter dropdown: filter contacts by list

7. Update Contact.findByWorkspaceId() in models/Contact.js:
   - Accept listId filter parameter
   - Join with contact_lists to include primary list name in results

8. Add POST /contacts/:id/change-list route:
   - Change primary list
   - Redirect back to contact detail
   - (Stage change logging comes in step 5.3)

9. Create tests/contact-lists-integration.test.js:
   - Test creating contact with primary list
   - Test assigning secondary lists
   - Test changing primary list
   - Test filtering contacts by list
   - Use REAL test database

VERIFY:
- npm start → create contact → select primary list and secondary tags
- Contact detail shows list assignments
- Change primary list from detail page
- Filter contact list by primary list
- npm test → all tests pass
```

---

### Step 5.3 — Stage Change Auto-Logging

**Context:** Primary list changes should be logged as events. This lays the groundwork for the communication log.

```text
You are working on the pi-crm project. Step 5.2 is complete: contacts have primary list
(pipeline stage) and secondary list (tag) assignments.

TASK — Auto-log stage changes when primary list changes:

1. Update config/database.js initDb() to create the communication_log table:
   CREATE TABLE IF NOT EXISTS communication_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     contact_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     type TEXT NOT NULL,
     direction TEXT,
     subject TEXT,
     body TEXT,
     metadata TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );

2. Create models/CommunicationLog.js:
   - CommunicationLog.create({ contactId, userId, type, direction, subject, body, metadata })
   - CommunicationLog.findByContactId(contactId, { type, limit, offset }) → paginated, reverse chronological
   - CommunicationLog.countByContactId(contactId, { type }) → count entries

3. Update the POST /contacts/:id/change-list route:
   - When primary list changes, create a communication log entry:
     type: 'stage_change'
     subject: 'Primary List changed'
     body: 'Moved from "[Old List Name]" to "[New List Name]"'
     metadata: JSON { fromListId, toListId, fromListName, toListName }
   - Use req.user.id as the userId

4. Also log stage changes when updating contact via POST /contacts/:id:
   - If primary_list_id changed, log the same way

5. On the contact detail page (views/contacts/detail.ejs):
   - Replace the "Communication log will appear here" placeholder
   - Show recent stage changes from communication_log where type='stage_change'
   - Formatted: "[date] — Moved from [Old] to [New]"
   - Limit to last 10 entries for now

6. Create tests/stage-change-log.test.js:
   - Test: changing primary list creates a log entry
   - Test: log entry contains correct from/to list names
   - Test: multiple changes create multiple entries in order
   - Test: log entries appear in reverse chronological order
   - Use REAL test database

VERIFY:
- npm start → change a contact's primary list → log entry appears on detail page
- Multiple changes → all logged in order
- npm test → all tests pass
```

---

## Phase 6: Communication Log & Notes

### Step 6.1 — Full Communication Log Display

**Context:** The communication_log table exists and stage changes are logged. Now we build the full tabbed log display on the contact detail page.

```text
You are working on the pi-crm project. Step 5.3 is complete: stage changes are auto-logged
in the communication_log table and displayed on the contact detail page.

TASK — Build the full communication log UI with tabs/filtering:

1. Update views/contacts/detail.ejs communication log section:
   - Tabbed interface using Tailwind CSS (no JS framework needed — use simple tab switching with vanilla JS):
     - All Activity (default tab) — unified timeline
     - Emails
     - Texts / SMS
     - Phone Calls
     - AI Interactions
     - Stage & List Changes
     - Notes & Manual Entries
     - Other / System Events
   - Each tab filters by communication_log.type
   - Each entry shows:
     - Timestamp (formatted nicely)
     - Type icon/badge (email icon, phone icon, note icon, etc. — use text/emoji for now)
     - Subject/preview line
     - Expandable body (click to expand/collapse)
   - Reverse chronological order (newest first)
   - "Load more" button for pagination (10 entries per page)

2. Add routes for loading log entries (for pagination):
   - GET /contacts/:id/log?type=&page= → returns rendered partial or JSON
   - Support type filter: 'all', 'email', 'sms', 'phone_call', 'ai_interaction', 'stage_change', 'note', 'system'

3. Update CommunicationLog model:
   - Add CommunicationLog.getTypes() → returns distinct types for a contact
   - Update findByContactId to support pagination: { page, perPage, type }

4. Add some basic client-side JavaScript in public/js/log.js:
   - Tab switching (show/hide content, update active tab style)
   - Expand/collapse log entries
   - "Load more" button fetches next page

5. Include the JS in the contact detail page.

6. Create tests/communication-log.test.js:
   - Test creating log entries of different types
   - Test filtering by type
   - Test pagination (create 15 entries, fetch page 1 and page 2)
   - Test reverse chronological ordering
   - Use REAL test database

VERIFY:
- npm start → contact detail page shows tabbed communication log
- Tabs filter entries by type
- Entries expand/collapse on click
- Stage changes from Phase 5 appear in the "Stage & List Changes" tab
- npm test → all tests pass
```

---

### Step 6.2 — Manual Notes + Pinned Notices

**Context:** The communication log displays entries. Now we need the ability to add manual notes and show pinned notices at the top of the contact detail.

```text
You are working on the pi-crm project. Step 6.1 is complete: the communication log has a
tabbed display with filtering, pagination, and expand/collapse.

TASK — Add manual notes and pinned notices:

1. Add a "Quick Note" form on the contact detail page:
   - Textarea + submit button above the communication log
   - POST /contacts/:id/notes → creates a communication_log entry with type='note'
   - Subject: auto-generated "Note by [user display name]"
   - Body: the note text
   - After submit, redirect back to contact detail with the new note visible

2. Add a "Log Phone Call" quick action:
   - Small form: subject (optional), notes (textarea), direction (inbound/outbound dropdown)
   - POST /contacts/:id/log-call → creates entry with type='phone_call'

3. Update the contact's last_contact_at field:
   - When a note, phone call, email, or SMS is logged → update contacts.last_contact_at
   - Contact model: Contact.updateLastContact(id)

4. Build the Pinned Notices section at the top of detail.ejs:
   - Query and display:
     - Last email sent: date + campaign name (if any) — from communication_log type='email' ORDER BY created_at DESC LIMIT 1
     - Current primary list + date of last list change
     - Shared status (shared_with_user_id is set: "Shared with [display name]")
     - Do Not Contact flag (if set, show prominent red warning)
   - Style as small cards/badges at the top of the page (Tailwind)
   - Data fetched in the GET /contacts/:id route and passed to the view

5. Update the detail page route (GET /contacts/:id):
   - Fetch pinned notice data (last email, last list change, etc.)
   - Pass to the view as pinnedNotices object

6. Create tests/notes-notices.test.js:
   - Test adding a manual note → appears in log
   - Test logging a phone call → appears in log
   - Test last_contact_at updates when note is added
   - Test pinned notices show correct data
   - Use REAL test database

VERIFY:
- npm start → contact detail page → add a note → appears in log immediately
- Log a phone call → appears under Phone Calls tab
- Pinned notices show at top: last email, current stage, shared status
- last_contact_at updates when actions are logged
- npm test → all tests pass
```

---

## Phase 7: Contact Sharing

### Step 7.1 — Share/Unshare + Shared Contacts View

**Context:** Contacts can be shared between Andy and Monalisa. Shared contacts are read-only for the viewer.

```text
You are working on the pi-crm project. Phase 6 is complete: communication log with tabs,
manual notes, phone call logging, and pinned notices are working.

TASK — Add contact sharing between users:

1. The contacts table already has shared_with_user_id. Use it:
   - When set, the contact is visible (read-only) to that user
   - Owner can set/unset this field

2. Update views/contacts/detail.ejs:
   - Add "Share" toggle/checkbox
   - If current user is the owner: show "Share with [other user name]" checkbox
   - POST /contacts/:id/share → set shared_with_user_id to the other user
   - POST /contacts/:id/unshare → set shared_with_user_id to NULL
   - Since there are only 2 users, the "other user" is straightforward to determine

3. Add routes in routes/contacts.js (or a new routes/sharing.js):
   - POST /contacts/:id/share → set shared_with_user_id
   - POST /contacts/:id/unshare → clear shared_with_user_id
   - Log sharing actions in communication_log (type='system', subject='Contact shared/unshared')

4. Create routes/sharing.js:
   - GET /shared → show all contacts shared with the current user (from other users' workspaces)
   - This view does NOT require a workspace to be active
   - Display contact info read-only (no edit/delete buttons)

5. Create views/sharing/index.ejs:
   - List of shared contacts with: name, workspace name (from owner), primary email, phone
   - Each contact links to a read-only detail view
   - "Save As" button on each contact

6. Add GET /shared/:id route:
   - Show contact detail in read-only mode
   - Verify the contact is actually shared with req.user.id

7. Update header.ejs nav:
   - Add "Shared with Me" link (show count badge if > 0)

8. Create tests/sharing.test.js:
   - Test: owner shares contact → other user can see it in /shared
   - Test: shared contact is read-only (cannot edit/delete)
   - Test: unsharing removes from shared view
   - Test: non-shared contacts are not visible
   - Use REAL test database with both users

VERIFY:
- npm start → login as Andy → share a contact → login as Monalisa → see it in "Shared with Me"
- Shared contact shows as read-only
- Unshare → disappears from Monalisa's shared view
- npm test → all tests pass
```

---

### Step 7.2 — Save As Copy + Revoke

**Context:** Shared contacts are visible read-only. Now add "Save As" to copy into own workspace, and owner revoke functionality.

```text
You are working on the pi-crm project. Step 7.1 is complete: contact sharing with read-only
view and shared contacts list is working.

TASK — Add "Save As" copy and revoke:

1. Add "Save As" to shared contact view (views/sharing/index.ejs and read-only detail):
   - Button: "Save to My Workspace"
   - Clicking shows a modal or new page: select target workspace from own workspaces
   - POST /shared/:id/save-as → creates independent copy of the contact in chosen workspace
   - Copies: all fields, emails, phones
   - Does NOT copy: communication log, list assignments (fresh start)
   - Sets the new contact's primary_list_id to the default list in the target workspace
   - Flash message: "Contact saved to [workspace name]"
   - Log in new contact's communication log: type='system', subject='Copied from shared contact'

2. Add route:
   - GET /shared/:id/save-as → show workspace selection form
   - POST /shared/:id/save-as → execute the copy with { targetWorkspaceId }

3. Owner revoke behavior:
   - When owner unshares (POST /contacts/:id/unshare):
     - Contact disappears from shared view
     - Any copies made via "Save As" remain unchanged (they're independent)
   - This is already handled by step 7.1's unshare route — just verify the behavior

4. Update pinned notices on contact detail:
   - If contact is shared, show: "Shared with [user name] since [date]"
   - If contact was copied from a share, show: "Copied from shared contact on [date]"

5. Create tests/save-as.test.js:
   - Test: Save As creates independent copy in target workspace
   - Test: Copy has all fields, emails, phones
   - Test: Copy does NOT have original's log entries
   - Test: Revoking share doesn't affect copies
   - Test: Can only Save As to own workspaces
   - Use REAL test database

VERIFY:
- npm start → login as Monalisa → "Shared with Me" → Save As → select workspace → contact copied
- Original contact unchanged, copy is independent
- Owner unshares → shared view updated, copies remain
- npm test → all tests pass
```

---

## Phase 8: Templates

### Step 8.1 — Template Model + CRUD

**Context:** Templates are workspace-scoped email templates with subject, body, and placeholders.

```text
You are working on the pi-crm project. Phase 7 is complete: contact sharing with read-only
view, Save As copy, and revoke are working.

TASK — Add email template model and CRUD:

1. Update config/database.js initDb() to create:
   CREATE TABLE IF NOT EXISTS templates (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     workspace_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     subject TEXT,
     preheader TEXT,
     body TEXT NOT NULL,
     placeholders TEXT,
     is_favorite INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
     FOREIGN KEY (user_id) REFERENCES users(id)
   );

2. Create models/Template.js:
   - Template.create({ workspaceId, userId, name, subject, preheader, body, placeholders })
   - Template.findById(id) → return template or null
   - Template.findByWorkspaceId(workspaceId, { search }) → list templates
   - Template.update(id, fields) → update template
   - Template.delete(id) → delete template
   - Template.toggleFavorite(id) → flip is_favorite
   - Template.extractPlaceholders(body) → parse {{placeholder_name}} patterns, return array
   - Placeholders stored as JSON array string in the placeholders column

3. Create routes/templates.js:
   - GET /templates → list templates in active workspace
   - GET /templates/new → show create form
   - POST /templates → create template (auto-extract placeholders from body)
   - GET /templates/:id → view template detail with preview
   - GET /templates/:id/edit → edit form
   - POST /templates/:id → update template
   - POST /templates/:id/delete → delete template
   - POST /templates/:id/favorite → toggle favorite
   - All routes scoped to active workspace

4. Create views:
   - views/templates/index.ejs — grid/list of templates with name, subject, favorite star, actions
   - views/templates/new.ejs — form: name, subject, preheader, body (textarea)
     - Helper text explaining {{first_name}}, {{last_name}}, {{company}} placeholders
   - views/templates/edit.ejs — same as new but pre-filled

5. Mount in app.js:
   - app.use('/templates', requireAuth, requireWorkspace, templateRoutes)

6. Update header.ejs nav:
   - Add "Templates" link

7. Create tests/templates.test.js:
   - Test creating template
   - Test placeholder extraction from body text
   - Test listing templates scoped to workspace
   - Test editing and deleting
   - Test favoriting
   - Use REAL test database

VERIFY:
- npm start → navigate to Templates → create template with placeholders → see in list
- Edit, delete, favorite templates
- Placeholders auto-extracted from body
- npm test → all tests pass
```

---

### Step 8.2 — Template Editor with Preview

**Context:** Templates have basic CRUD. Now add a richer editor with live preview and placeholder replacement.

```text
You are working on the pi-crm project. Step 8.1 is complete: template model and CRUD with
placeholder extraction are working.

TASK — Add template editor with live preview:

1. Create views/templates/editor.ejs:
   - Split view: editor on left, preview on right (responsive — stacks on mobile)
   - Editor panel:
     - Name field
     - Subject field (with placeholder support)
     - Preheader field
     - Body: rich textarea with basic formatting toolbar:
       - Bold, italic, link insertion
       - Placeholder insertion dropdown: click to insert {{first_name}}, {{last_name}}, etc.
       - Image URL insertion (inline image support)
     - Signature section
   - Preview panel:
     - Renders the template body as HTML
     - Replaces placeholders with sample data:
       {{first_name}} → "John", {{last_name}} → "Smith", {{company}} → "Acme Corp"
     - Updates in real-time as you type (debounced)

2. Create public/js/template-editor.js:
   - Live preview rendering: parse body textarea, replace placeholders, update preview div
   - Placeholder insertion: click toolbar button → insert at cursor position
   - Debounced preview updates (300ms)
   - Bold/italic: wrap selection in <strong>/<em> tags
   - Link insertion: prompt for URL, wrap selection in <a> tag

3. Update routes/templates.js:
   - GET /templates/new → now renders editor.ejs instead of new.ejs
   - GET /templates/:id/edit → renders editor.ejs with data pre-filled
   - GET /templates/:id/preview → renders preview.ejs (standalone preview)

4. Create views/templates/preview.ejs:
   - Full standalone preview of the template
   - Shows subject, preheader, rendered body
   - "Back to Edit" button
   - "Send Test Email" button (placeholder — wired in Phase 10)

5. Create tests/template-preview.test.js:
   - Test template creation via editor form
   - Test placeholder extraction matches body content
   - Test template preview route returns rendered HTML
   - Use REAL test database

VERIFY:
- npm start → create template in editor → see live preview updating
- Insert placeholders via toolbar → preview shows sample replacements
- Edit existing template → editor pre-filled, preview works
- Standalone preview page renders correctly
- npm test → all tests pass
```

---

### Step 8.3 — Copy/Share Templates Between Workspaces

**Context:** Templates are workspace-scoped. Users need to copy templates to other workspaces and share with the other user.

```text
You are working on the pi-crm project. Step 8.2 is complete: template editor with live preview
and placeholder toolbar are working.

TASK — Add template copy and sharing:

1. Add "Copy to Workspace" feature:
   - On template detail/edit page: "Copy to Another Workspace" button
   - GET /templates/:id/copy → show workspace selection form (list user's other workspaces)
   - POST /templates/:id/copy → duplicate template into selected workspace
   - New copy has: same name + " (Copy)", same subject/body/placeholders
   - New copy's user_id = current user, workspace_id = target workspace

2. Add "Share with [other user]" feature:
   - Similar to contact sharing but simpler:
   - POST /templates/:id/share → makes template visible to other user (read-only)
   - Implementation: add shared_with_user_id column to templates table
     (ALTER TABLE templates ADD COLUMN shared_with_user_id INTEGER)
   - Other user sees it in a "Shared Templates" section
   - Other user can "Save As" to copy into their workspace

3. Add Global Favorites Library concept:
   - GET /templates/favorites → show all favorited templates across all user's workspaces
   - From favorites view, can "Push to Workspace" → copy to any workspace

4. Create routes for sharing:
   - POST /templates/:id/share → share with other user
   - POST /templates/:id/unshare → unshare
   - GET /templates/shared → show templates shared with current user
   - POST /templates/shared/:id/save-as → copy shared template to own workspace

5. Update views/templates/index.ejs:
   - Add "Shared" tab/section showing templates shared by other user
   - Add copy/share action buttons on each template

6. Create tests/template-sharing.test.js:
   - Test copy to another workspace
   - Test share with other user → visible read-only
   - Test save-as creates independent copy
   - Test favorites list shows cross-workspace favorites
   - Use REAL test database

VERIFY:
- npm start → create template → copy to another workspace → verify in target
- Share template with other user → they can see it read-only → Save As works
- Favorites page shows favorited templates from all workspaces
- npm test → all tests pass
```

---

## Phase 9: CSV Import/Export

### Step 9.1 — CSV Export

**Context:** Users need to export contacts from a workspace or list as CSV files.

```text
You are working on the pi-crm project. Phase 8 is complete: templates with editor, preview,
copy, and sharing are working.

TASK — Add CSV export from workspace and list views:

1. Install csv-stringify (or use a lightweight CSV library):
   npm install csv-stringify

2. Create services/csv-export.js:
   - exportContacts(contacts, options) → generates CSV string
   - Default fields: First Name, Last Name, Primary Email, Primary Phone, Company,
     Primary List, Secondary Tags, Created, Last Contact
   - Accept optional field selection (array of field names to include)
   - Handle proper CSV escaping (commas in fields, quotes, newlines)

3. Add export routes in routes/import-export.js:
   - GET /export → show export options page (select fields, choose workspace or specific list)
   - POST /export → generate and download CSV file
   - Set response headers: Content-Type: text/csv, Content-Disposition: attachment
   - Filename: [workspace-name]-contacts-[date].csv

4. Create views/import-export/export.ejs:
   - Workspace selector (default: active workspace)
   - Optional list filter (export only contacts in a specific list)
   - Field checkboxes: select which fields to include (all checked by default)
   - "Export" button
   - Show contact count that will be exported

5. Mount in app.js:
   - app.use('/import-export', requireAuth, requireWorkspace, importExportRoutes)
   - Or simpler: app.use('/', requireAuth, requireWorkspace, importExportRoutes) with /export prefix in routes

6. Update header.ejs nav or add to workspace settings area:
   - Add "Import / Export" link

7. Also add export from list view:
   - On views/lists/view.ejs (list detail showing contacts), add "Export This List" button
   - Links to /export?listId=:id

8. Create tests/csv-export.test.js:
   - Test CSV export contains correct headers
   - Test CSV export contains all contacts in workspace
   - Test CSV export with list filter only includes list contacts
   - Test CSV escaping handles commas and quotes in data
   - Test field selection works (only selected fields appear)
   - Use REAL test database with seeded contacts

VERIFY:
- npm start → navigate to Export → select options → download CSV
- Open CSV in a spreadsheet app → data is correct and properly formatted
- Export from list view → only list contacts included
- npm test → all tests pass
```

---

### Step 9.2 — CSV Import with Column Mapping + Duplicate Handling

**Context:** Export works. Now add CSV import with column mapping and duplicate detection.

```text
You are working on the pi-crm project. Step 9.1 is complete: CSV export is working with
field selection and list filtering.

TASK — Add CSV import with column mapping and duplicate handling:

1. Install csv-parse:
   npm install csv-parse

2. Create services/csv-import.js:
   - parseCSV(fileContent) → parse CSV, return { headers: [], rows: [] }
   - mapColumns(rows, mapping) → transform rows using user-defined column mapping
   - validateRow(row) → check required fields (first_name at minimum), return { valid, errors }
   - importContacts(workspaceId, userId, rows, options) → bulk import with:
     - Duplicate checking (via duplicate-detector service)
     - Options: { primaryListId, secondaryListIds, onDuplicate: 'skip' | 'create' }
     - Returns: { imported: count, skipped: count, errors: [] }

3. Update routes/import-export.js:
   - GET /import → show import page
   - POST /import/upload → accept CSV file upload, parse, show column mapping page
   - POST /import/execute → execute import with mapped columns

4. Install multer for file upload: npm install multer

5. Create views/import-export/import.ejs:
   - Step 1: File upload form (drag & drop or file picker, accept .csv)
   - Submit uploads file to /import/upload

6. Create views/import-export/import-mapping.ejs:
   - Step 2: Column mapping
   - Shows CSV headers on left, dropdown of contact fields on right
   - Auto-map obvious matches (e.g., "First Name" → first_name, "Email" → email)
   - Select primary list assignment for all imported contacts
   - Select secondary list tags (optional)
   - Preview first 5 rows of data
   - Duplicate handling option: Skip duplicates / Create anyway
   - "Import" button

7. Create views/import-export/import-results.ejs:
   - Step 3: Results
   - Show: X contacts imported, Y skipped (duplicates), Z errors
   - List any error rows with reasons
   - "View Contacts" link

8. Handle edge cases:
   - Empty rows → skip
   - Missing required fields → skip with error message
   - Invalid email format → warn but allow
   - Very large files → process in chunks (100 rows at a time)

9. Create tests/csv-import.test.js:
   - Test CSV parsing with various formats
   - Test column auto-mapping
   - Test import creates contacts with correct fields
   - Test duplicate detection during import (skip and create modes)
   - Test invalid rows are skipped with errors
   - Test imported contacts have correct list assignments
   - Use REAL test database and REAL CSV content (not mock data)

VERIFY:
- npm start → Import page → upload CSV → map columns → import
- Contacts appear in workspace with correct data
- Duplicates handled according to selection
- Error rows shown in results
- npm test → all tests pass
```

---

## Phase 10: Email Integration

### Step 10.1 — Email Provider Configuration

**Context:** Each workspace uses a different email provider (Google Workspace, Mailgun, Microsoft 365). We need a settings UI to configure these per workspace.

```text
You are working on the pi-crm project. Phase 9 is complete: CSV import/export with column
mapping and duplicate handling are working.

TASK — Add email provider configuration per workspace:

1. The workspaces table already has email_provider and email_config columns.

2. Create views/settings/workspace.ejs:
   - Workspace settings page accessible from workspace edit or nav
   - Email Provider section:
     - Provider dropdown: Google Workspace, Mailgun, Microsoft 365, None
     - Based on selection, show relevant config fields:
       - Google Workspace: OAuth2 (client ID, client secret, refresh token) — or App Password (email, app password)
       - Mailgun: API key, domain, from email
       - Microsoft 365: OAuth2 or SMTP (email, app password)
     - "Test Connection" button (sends a test email to the user's own email)
     - "Save" button

3. Create routes/settings.js:
   - GET /settings/workspace → show workspace settings (email config)
   - POST /settings/workspace/email → save email provider config
   - POST /settings/workspace/email/test → send test email
   - Config is stored encrypted in workspaces.email_config as JSON

4. Create config/email-providers.js:
   - Factory function: getEmailProvider(workspace) → returns configured email client
   - Supports: 'mailgun', 'google', 'microsoft365'
   - Each returns an object with: sendEmail({ to, subject, html, from })
   - For now, implement Mailgun first (simplest API-based provider)

5. Install nodemailer (for SMTP-based providers) and mailgun.js + form-data (for Mailgun):
   npm install nodemailer mailgun.js form-data

6. For encryption of stored credentials:
   - Use Node.js built-in crypto module
   - Create a simple encrypt/decrypt utility using AES-256-GCM
   - Encryption key from ENCRYPTION_KEY env var (add to .env.example)
   - Encrypt email_config before storing, decrypt when reading

7. Mount in app.js:
   - app.use('/settings', requireAuth, requireWorkspace, settingsRoutes)

8. Update header.ejs nav:
   - Add "Settings" gear icon link (visible when workspace is active)

9. Create tests/email-config.test.js:
   - Test saving email provider config (encrypted)
   - Test loading config (decrypted)
   - Test encryption/decryption round-trip
   - Do NOT test actual email sending here (that's step 10.2)
   - Use REAL test database

VERIFY:
- npm start → workspace settings → configure Mailgun with real API key → save
- Config is stored encrypted in database
- Test Connection sends a real test email (use a real Mailgun account)
- npm test → all tests pass
```

---

### Step 10.2 — Email Sending Service

**Context:** Email provider config is stored. Now implement the actual email sending service that works with all three providers.

```text
You are working on the pi-crm project. Step 10.1 is complete: email provider configuration
per workspace with encrypted storage and Mailgun setup.

TASK — Implement email sending service for all providers:

1. Create services/email.js:
   - EmailService class:
     - constructor(workspace) → load and decrypt email config, initialize provider
     - async sendEmail({ to, subject, html, text, from }) → send via configured provider
     - async sendTemplateEmail({ to, template, placeholderData }) →
       - Replace placeholders in template body/subject with actual data
       - Send via sendEmail()
     - Returns: { success: boolean, messageId: string, error: string }

2. Implement provider-specific senders in config/email-providers.js:
   - MailgunProvider:
     - Uses mailgun.js client
     - Sends via Mailgun API
     - Returns message ID from response
   - GoogleProvider:
     - Uses nodemailer with SMTP (smtp.gmail.com, port 587)
     - Auth: OAuth2 or app password
   - MicrosoftProvider:
     - Uses nodemailer with SMTP (smtp.office365.com, port 587)
     - Auth: OAuth2 or app password

3. Add "Send Email" action on contact detail page:
   - Button on contact detail: "Send Email"
   - GET /contacts/:id/email → show compose form:
     - To: pre-filled with contact's primary email (dropdown to select other emails)
     - Subject: text field
     - Body: textarea (or select a template)
     - Template selector: dropdown of workspace templates
     - If template selected: body pre-filled with template content, placeholders replaced
   - POST /contacts/:id/email → send the email via EmailService

4. Create views/contacts/email.ejs:
   - Compose form with: to, subject, body
   - Template dropdown (populated from workspace templates)
   - When template selected: subject and body auto-fill (use JS fetch to load template data)
   - "Send" button
   - Preview before send (optional)

5. Add route:
   - GET /contacts/:id/email → render compose form
   - POST /contacts/:id/email → validate, send email, log in communication log, redirect to contact detail
   - GET /api/templates/:id → JSON endpoint to fetch template data for the compose form

6. After sending, log in communication_log:
   - type: 'email'
   - direction: 'outbound'
   - subject: email subject
   - body: email body (HTML)
   - metadata: JSON { messageId, provider, to, from, templateId }

7. Update last_contact_at on the contact after sending.

8. Create tests/email-sending.test.js:
   - Test placeholder replacement in template
   - Test compose form renders with contact data
   - Test email is logged in communication log after sending
   - For actual sending: ONLY if MAILGUN_API_KEY is set in env (skip with message if not)
   - Test with REAL Mailgun send to a test email address
   - Use REAL test database

VERIFY:
- npm start → contact detail → Send Email → compose with template → send
- Real email arrives at the recipient
- Email logged in communication log
- last_contact_at updated
- npm test → all tests pass (email send tests require real Mailgun config)
```

---

### Step 10.3 — Email Logging Integration

**Context:** Emails can be sent. Ensure all sent emails are properly logged and visible in the communication log with full metadata.

```text
You are working on the pi-crm project. Step 10.2 is complete: email sending via Mailgun/SMTP
works with template support and communication log entries.

TASK — Polish email logging and add email tab details:

1. Update the communication log email entries display:
   - In the "Emails" tab on contact detail:
     - Show: date, direction (Sent/Received icon), subject, from, to
     - Expandable: full email body (rendered HTML in iframe or sanitized)
     - Metadata: template used, campaign (if any), provider, message ID
   - Style email entries distinctly from other log types

2. Add email status tracking (basic):
   - Update CommunicationLog entry creation for emails to include:
     - Status: 'sent', 'delivered', 'bounced' (start with 'sent', delivery tracking is future)
   - Display status badge on email entries

3. Update pinned notices on contact detail:
   - "Last email sent: [date] [subject]" — now pulls from real communication_log data
   - "Last email sent via: [template name / direct]"

4. Add "Resend" action on sent email log entries:
   - Small "Resend" link on each sent email entry
   - GET /contacts/:id/email/resend/:logId → pre-fill compose form with previous email data
   - User can modify before resending

5. Track email count per contact:
   - Contact.getEmailStats(contactId) → { totalSent, lastSentDate, lastSentSubject }
   - Use in pinned notices and dashboard

6. Create tests/email-logging.test.js:
   - Test email log entries have correct metadata
   - Test email stats calculation
   - Test pinned notice shows last email
   - Test resend pre-fills compose form
   - Use REAL test database

VERIFY:
- npm start → send email → see detailed entry in Emails tab
- Pinned notices show last email info
- Resend action works
- npm test → all tests pass
```

---

## Phase 11: Campaigns

### Step 11.1 — Campaign Model + One-Off Campaign Creation

**Context:** Email sending works. Now build the campaign system starting with simple one-off campaigns.

```text
You are working on the pi-crm project. Phase 10 is complete: email sending with Mailgun/SMTP,
template integration, and full logging are working.

TASK — Add campaign model and one-off campaign creation:

1. Update config/database.js initDb() to create:
   CREATE TABLE IF NOT EXISTS campaigns (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     workspace_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     template_id INTEGER,
     name TEXT NOT NULL,
     type TEXT NOT NULL DEFAULT 'immediate',
     status TEXT DEFAULT 'draft',
     schedule_at TEXT,
     drip_config TEXT,
     recipient_filter TEXT,
     approved_by INTEGER,
     approved_at TEXT,
     sent_at TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
     FOREIGN KEY (user_id) REFERENCES users(id),
     FOREIGN KEY (template_id) REFERENCES templates(id),
     FOREIGN KEY (approved_by) REFERENCES users(id)
   );

   CREATE TABLE IF NOT EXISTS campaign_recipients (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     campaign_id INTEGER NOT NULL,
     contact_id INTEGER NOT NULL,
     status TEXT DEFAULT 'pending',
     sent_at TEXT,
     metadata TEXT,
     FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
     FOREIGN KEY (contact_id) REFERENCES contacts(id)
   );

2. Create models/Campaign.js:
   - Campaign.create({ workspaceId, userId, name, type, templateId })
   - Campaign.findById(id)
   - Campaign.findByWorkspaceId(workspaceId, { status, type })
   - Campaign.update(id, fields)
   - Campaign.delete(id) → only if status = 'draft'
   - Campaign.addRecipients(campaignId, contactIds)
   - Campaign.getRecipients(campaignId)
   - Campaign.updateRecipientStatus(campaignId, contactId, status, metadata)
   - Campaign.getStats(campaignId) → { total, sent, pending, bounced }

3. Create routes/campaigns.js:
   - GET /campaigns → list campaigns in workspace
   - GET /campaigns/new → create form (name, template selector, type)
   - POST /campaigns → create campaign (draft status)
   - GET /campaigns/:id → campaign detail page (recipients, stats, status)
   - GET /campaigns/:id/edit → edit draft campaign
   - POST /campaigns/:id → update campaign
   - POST /campaigns/:id/delete → delete draft campaign

4. Create views:
   - views/campaigns/index.ejs — campaign list with name, type, status, stats, dates
   - views/campaigns/new.ejs — form: name, template (dropdown), type (radio: immediate)
   - views/campaigns/detail.ejs — campaign overview: template preview, recipient list, stats, actions

5. Mount in app.js:
   - app.use('/campaigns', requireAuth, requireWorkspace, campaignRoutes)

6. Update header.ejs nav: add "Campaigns" link

7. Create tests/campaigns.test.js:
   - Test creating a campaign
   - Test listing campaigns by workspace
   - Test campaign detail shows correct data
   - Test can only delete draft campaigns
   - Use REAL test database

VERIFY:
- npm start → create a one-off campaign → select template → see in list
- Campaign detail shows template preview
- npm test → all tests pass
```

---

### Step 11.2 — Recipient Selection

**Context:** Campaigns can be created. Now add recipient selection with various filtering options.

```text
You are working on the pi-crm project. Step 11.1 is complete: campaign model and one-off
campaign creation are working.

TASK — Add recipient selection to campaigns:

1. Add recipient selection step to campaign creation flow:
   - GET /campaigns/:id/recipients → show recipient selection page

2. Create views/campaigns/recipients.ejs:
   - Selection methods (tabs or sections):
     a. "By List" — select a primary list → all contacts in that list
     b. "By Filter" — filter criteria:
        - Last campaign sent > X days ago
        - Secondary list tags (multi-select)
        - Last contact > X days ago
        - Has email (required for email campaigns)
     c. "Manual" — checkbox list of all contacts with search
     d. "Exclusions" — exclude: already received this template, Do Not Contact flagged
   - Show count of selected recipients dynamically
   - "Confirm Selection" button

3. Update routes/campaigns.js:
   - GET /campaigns/:id/recipients → render recipient selection page
   - POST /campaigns/:id/recipients → save selected recipients to campaign_recipients table
   - POST /campaigns/:id/recipients/by-list → select by list ID
   - POST /campaigns/:id/recipients/by-filter → select by filter criteria
   - POST /campaigns/:id/recipients/manual → select specific contact IDs

4. Add recipient filtering logic in models/Campaign.js:
   - Campaign.selectByList(campaignId, listId) → add all contacts in list
   - Campaign.selectByFilter(campaignId, workspaceId, filters) → add filtered contacts
   - Campaign.removeRecipient(campaignId, contactId) → remove single recipient
   - Campaign.clearRecipients(campaignId) → remove all (for re-selection)

5. Update views/campaigns/detail.ejs:
   - Show recipient list with count
   - "Edit Recipients" button (only if draft)
   - Individual remove buttons per recipient

6. Create tests/campaign-recipients.test.js:
   - Test selecting recipients by list
   - Test filtering excludes Do Not Contact
   - Test manual selection
   - Test recipient count matches
   - Test removing recipients
   - Use REAL test database with seeded contacts in various lists

VERIFY:
- npm start → campaign → select recipients by list → see count
- Filter recipients → correct subset selected
- Manual selection → checkboxes work
- Do Not Contact contacts excluded
- npm test → all tests pass
```

---

### Step 11.3 — Campaign Sending + Scheduled Campaigns

**Context:** Campaigns have recipients. Now add the ability to send campaigns and schedule them.

```text
You are working on the pi-crm project. Step 11.2 is complete: recipient selection with
list-based, filter-based, and manual selection are working.

TASK — Add campaign sending and scheduling:

1. Create services/campaign-sender.js:
   - CampaignSender.send(campaignId) →
     - Load campaign with template and recipients
     - For each recipient:
       - Get contact data (for placeholder replacement)
       - Use EmailService to send template email to contact's primary email
       - Update campaign_recipients status ('sent' or 'bounced')
       - Create communication_log entry for each send
       - Update contact's last_contact_at
     - Update campaign status to 'sent' and set sent_at
     - Return results: { sent, failed, errors }
   - Process recipients sequentially (rate limiting for email providers)
   - Add 200ms delay between sends to respect API limits

2. Add send routes:
   - POST /campaigns/:id/send → immediately send the campaign
     - Only allow if status = 'draft' or 'approved' (for Loan Factory)
     - Redirect to campaign detail with flash results
   - POST /campaigns/:id/schedule → schedule for later
     - Accept schedule_at datetime
     - Set status = 'scheduled', save schedule_at

3. Install node-cron for scheduled campaign execution:
   npm install node-cron

4. Create services/scheduler.js:
   - On app startup, check for campaigns where status='scheduled' and schedule_at <= now
   - Run a cron job every minute to check for scheduled campaigns
   - When found, execute CampaignSender.send()
   - Update status appropriately

5. Wire scheduler into app.js:
   - Start scheduler on app startup (but not during tests)

6. Update campaign creation flow:
   - In views/campaigns/new.ejs: add type selection
     - Immediate: send now (after recipient selection)
     - Scheduled: show datetime picker for schedule_at
   - Update views/campaigns/detail.ejs:
     - Show "Send Now" button (for draft/approved campaigns)
     - Show "Schedule" button with datetime picker
     - Show scheduled time if status = 'scheduled'
     - Show send results after sending (sent count, errors)

7. Create tests/campaign-sending.test.js:
   - Test campaign sending updates recipient statuses
   - Test communication log entries created for each recipient
   - Test campaign status changes to 'sent'
   - Test scheduled campaign has correct status and schedule_at
   - For actual email sending: only if MAILGUN_API_KEY is set
   - Use REAL test database

VERIFY:
- npm start → create campaign → add recipients → Send Now → emails sent
- Each recipient gets the email, log entries created
- Schedule campaign for future time → status shows 'scheduled'
- Scheduler fires and sends at the right time (test with 1 minute in future)
- npm test → all tests pass
```

---

### Step 11.4 — Drip Sequences + Loan Factory Approval Workflow

**Context:** One-off and scheduled campaigns work. Now add multi-step drip sequences and the approval workflow for Loan Factory.

```text
You are working on the pi-crm project. Step 11.3 is complete: immediate and scheduled
campaign sending with logging are working.

TASK — Add drip sequences and approval workflow:

1. Drip sequence support:
   - A drip campaign has multiple steps, each with a delay and template
   - drip_config JSON structure:
     {
       "steps": [
         { "templateId": 1, "delayDays": 0, "subject": "Welcome!" },
         { "templateId": 2, "delayDays": 3, "subject": "Follow up" },
         { "templateId": 3, "delayDays": 7, "subject": "Check in" }
       ],
       "exitConditions": ["replied", "unsubscribed"]
     }

2. Update campaign creation for drip type:
   - GET /campaigns/new → if type = 'drip', show step builder
   - Step builder UI:
     - Add steps: template selector + delay (in days) for each step
     - Reorder steps (up/down)
     - Remove steps
     - Exit conditions checkboxes

3. Create views/campaigns/drip-builder.ejs:
   - Dynamic form for building drip steps
   - Each step: template dropdown, delay days input, preview
   - "Add Step" button
   - Submit saves drip_config JSON

4. Update services/campaign-sender.js for drip campaigns:
   - CampaignSender.processDripStep(campaignId, stepIndex) →
     - For each recipient whose current step = stepIndex and delay has elapsed:
       - Send the step's template email
       - Update recipient metadata with current step + sent date
     - Schedule next step check via cron
   - The scheduler checks drip campaigns and processes due steps

5. Add Loan Factory approval workflow:
   - On campaign creation: if workspace name = "Loan Factory" AND campaign is custom:
     - Set status = 'pending_approval'
     - Show in pending approval queue for Andy
   - POST /campaigns/:id/approve → Andy approves (set status='approved', approved_by, approved_at)
   - POST /campaigns/:id/reject → Andy rejects (set status='rejected', add note)
   - POST /campaigns/:id/edit → Andy can edit before approving

6. Create routes/approval.js:
   - GET /approvals → list campaigns pending approval (only for Andy)
   - POST /approvals/:id/approve → approve
   - POST /approvals/:id/reject → reject with reason

7. Create views/campaigns/approval.ejs:
   - Pending campaigns list with: name, creator, template preview, recipients count
   - Approve / Reject / Edit buttons
   - Reject requires reason text

8. Mount: app.use('/approvals', requireAuth, approvalRoutes)

9. Create tests/drip-campaigns.test.js:
   - Test drip config is saved correctly
   - Test step processing sends correct template at correct delay
   - Test approval workflow: submit → pending → approve → can send
   - Test rejection: submit → pending → reject → cannot send
   - Test only Andy can approve
   - Use REAL test database

VERIFY:
- npm start → create drip campaign → add 3 steps → recipients → activate
- Step 1 sends immediately, step 2 after delay
- Create campaign in Loan Factory → goes to pending approval
- Login as Andy → approve → campaign can be sent
- npm test → all tests pass
```

---

## Phase 12: Twilio SMS

### Step 12.1 — Twilio Configuration + Send SMS from Contact

**Context:** Email campaigns work. Now add Twilio SMS for outbound text messaging.

```text
You are working on the pi-crm project. Phase 11 is complete: campaigns with immediate,
scheduled, and drip sending plus approval workflow are working.

TASK — Add Twilio SMS integration:

1. Install twilio SDK:
   npm install twilio

2. Add to .env and .env.example:
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_PHONE_NUMBER=

3. Create services/sms.js:
   - SmsService class:
     - constructor() → initialize Twilio client from env vars
     - async sendSms({ to, body, from }) → send SMS via Twilio
       - from defaults to TWILIO_PHONE_NUMBER
       - Returns: { success, messageSid, error }
     - async sendTemplateSms({ to, template, placeholderData }) →
       - Replace placeholders in template body (text only, strip HTML)
       - Send via sendSms()

4. Add SMS action on contact detail page:
   - "Send Text" button next to "Send Email" on contact detail
   - GET /contacts/:id/sms → show compose form
   - POST /contacts/:id/sms → send SMS, log, redirect to detail

5. Create views/contacts/sms.ejs:
   - Compose form:
     - To: contact's primary phone (dropdown to select other phones)
     - Message: textarea (character count shown, 160 char SMS limit indicator)
     - Template selector: dropdown (text-only templates)
   - "Send" button

6. Create routes/sms.js:
   - GET /contacts/:id/sms → render SMS compose form
   - POST /contacts/:id/sms → validate, send via SmsService, log, redirect
   - Mount: app.use('/contacts', requireAuth, requireWorkspace, smsRoutes)
     Or add to existing contacts routes

7. After sending, log in communication_log:
   - type: 'sms'
   - direction: 'outbound'
   - body: message text
   - metadata: JSON { messageSid, to, from, status }

8. Update contact's last_contact_at after sending.

9. Create tests/sms.test.js:
   - Test SMS compose form renders with contact phone
   - Test SMS is logged in communication log after sending
   - Test last_contact_at updates
   - For actual sending: only if TWILIO_ACCOUNT_SID is set
   - Test with REAL Twilio send to a test phone number
   - Use REAL test database

VERIFY:
- npm start → contact detail → Send Text → compose → send
- Real SMS arrives at the phone number (with real Twilio credentials)
- SMS logged in communication log under "Texts / SMS" tab
- npm test → all tests pass
```

---

### Step 12.2 — SMS Logging + Bulk SMS

**Context:** Single SMS sending works. Now add bulk SMS from a list and ensure full logging integration.

```text
You are working on the pi-crm project. Step 12.1 is complete: Twilio SMS sending from
contact detail with logging is working.

TASK — Add bulk SMS and polish logging:

1. Add bulk SMS action from list view:
   - On views/lists/view.ejs: "Send Bulk Text" button
   - GET /lists/:id/bulk-sms → show bulk SMS compose form
   - Shows: list name, recipient count, contacts with phones listed

2. Create views/lists/bulk-sms.ejs:
   - Shows selected list and recipient count
   - Message textarea (same as individual compose)
   - Template selector
   - Checkbox: "Skip contacts without phone numbers"
   - "Send to All" button
   - Preview showing first 3 recipients and their phones

3. Add routes:
   - GET /lists/:id/bulk-sms → render bulk compose
   - POST /lists/:id/bulk-sms → send SMS to all contacts in list with phone numbers
   - Process sequentially with delay between sends (Twilio rate limits)
   - Show results: sent count, failed count, skipped (no phone)

4. Update SMS section in communication log:
   - Display: date, direction, message preview
   - Expandable: full message, phone number, status
   - Status from Twilio: queued → sent → delivered (basic tracking)

5. Add "Quick Text" from contact list page:
   - Inline action on each contact row: small "Text" icon/button
   - Opens a modal or redirects to /contacts/:id/sms

6. Create tests/bulk-sms.test.js:
   - Test bulk SMS sends to all contacts in list with phones
   - Test contacts without phones are skipped
   - Test each send creates a log entry
   - Test bulk results show correct counts
   - Use REAL test database (Twilio sends only if configured)

VERIFY:
- npm start → list view → Bulk Text → compose → send to all
- Each recipient gets SMS (with real Twilio)
- All sends logged in communication log
- Contacts without phones skipped gracefully
- npm test → all tests pass
```

---

## Phase 13: Dashboard

### Step 13.1 — Dashboard Layout + Activity + Approvals

**Context:** All core features are built. Now create the full dashboard replacing the simple contact count display.

```text
You are working on the pi-crm project. Phase 12 is complete: Twilio SMS with individual
and bulk sending are working.

TASK — Build the full dashboard:

1. Update routes — move dashboard to routes/dashboard.js:
   - GET / → render views/dashboard/index.ejs
   - Collect data for all dashboard widgets
   - Mount: app.use('/', requireAuth, dashboardRoutes)

2. Create views/dashboard/index.ejs with widget sections (priority order from spec):

   a. Pending Approvals (Loan Factory — Andy only):
      - Count of campaigns with status='pending_approval' where workspace is Loan Factory
      - List with: campaign name, creator, date submitted
      - "Review" link to approval page
      - Only visible to Andy

   b. Recent Activity Needing Attention:
      - Bounced emails (from campaign_recipients where status='bounced')
      - Unactioned items (contacts added in last 7 days with no communication)
      - New shared contacts
      - Stalled contacts (no communication > 30 days in active lists)
      - Each item: type icon, description, "Take Action" link

   c. Todos / Action Items:
      - Manual todo list (simple add/remove/complete)
      - Store in a new todos table: id, user_id, text, completed, created_at
      - Quick add form at top

   d. Recent Contacts / Hot Leads:
      - Last 5 contacts added or modified
      - Contacts in "Hot Leads" or similar secondary list

   e. Active & Upcoming Campaigns:
      - Campaigns with status in ('sending', 'scheduled')
      - Show: name, type, status, recipient count, scheduled date

   f. Quick Stats:
      - Total contacts across all workspaces
      - Contacts added this week/month
      - Emails sent this week/month
      - SMS sent this week/month

3. Create a todos table in config/database.js:
   CREATE TABLE IF NOT EXISTS todos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     text TEXT NOT NULL,
     completed INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (user_id) REFERENCES users(id)
   );

4. Add todo routes in routes/dashboard.js:
   - POST /todos → add todo
   - POST /todos/:id/complete → toggle complete
   - POST /todos/:id/delete → delete todo

5. Style with Tailwind: clean grid layout, cards for each section, responsive.

6. Create tests/dashboard.test.js:
   - Test dashboard loads with correct widget data
   - Test pending approvals show only for Andy
   - Test quick stats match actual data
   - Test todo CRUD
   - Use REAL test database with seeded data

VERIFY:
- npm start → login → dashboard shows all widgets with real data
- Pending approvals visible only for Andy
- Todos can be added/completed/deleted
- Quick stats accurate
- npm test → all tests pass
```

---

### Step 13.2 — Dashboard Polish + Calendar + AI Insights Placeholder

**Context:** The core dashboard is working. Add calendar/events and prepare for AI insights.

```text
You are working on the pi-crm project. Step 13.1 is complete: dashboard with all core
widgets (approvals, activity, todos, stats, campaigns) is working.

TASK — Polish dashboard and add remaining sections:

1. Add Calendar / Upcoming Events section:
   - Show upcoming birthdays (contacts with birthday in next 30 days)
   - Show scheduled campaigns (next 7 days)
   - Simple list format (no full calendar widget needed)
   - "Upcoming birthdays" with: contact name, date, workspace
   - "Scheduled campaigns" with: name, date, workspace

2. Add AI Insights placeholder:
   - "AI Insights" card with placeholder text: "AI insights coming soon"
   - Will be populated in Phase 14
   - Show an example insight card with static text for layout purposes

3. Add workspace quick-switch on dashboard:
   - Quick cards for each workspace showing:
     - Name
     - Contact count
     - Active campaigns count
     - "Open" button to switch and go to contacts

4. Add Smart Suggestions section (rule-based, not AI):
   - New contacts in "Leads" lists → "Enroll in welcome campaign?"
   - Contacts inactive > 60 days → "Send re-engagement campaign?"
   - Upcoming holidays → "Schedule holiday campaign?"
   - Each suggestion: description, "Take Action" button, "Dismiss" button
   - Dismissed suggestions stored in a simple JSON preference

5. Update dashboard layout:
   - Responsive grid: 2 columns on desktop, 1 on mobile
   - Collapsible sections
   - "Last refreshed" timestamp

6. Update tests/dashboard.test.js:
   - Test upcoming birthdays appear (create contacts with upcoming birthdays)
   - Test workspace cards show correct counts
   - Test smart suggestions appear for inactive contacts
   - Use REAL test database

VERIFY:
- npm start → dashboard is polished with all sections
- Upcoming birthdays and scheduled campaigns show
- Workspace quick-switch cards work
- Smart suggestions appear when conditions are met
- npm test → all tests pass
```

---

## Phase 14: AI Features

### Step 14.1 — AI Service Configuration + Template Generation

**Context:** All core CRM features are built. Now add AI-powered template generation.

```text
You are working on the pi-crm project. Phase 13 is complete: full dashboard with all widgets,
calendar, and smart suggestions is working.

TASK — Add AI template generation:

1. Add to .env and .env.example:
   AI_PROVIDER=openai          # or 'anthropic'
   OPENAI_API_KEY=
   ANTHROPIC_API_KEY=
   AI_MODEL=gpt-4o-mini        # or claude-3-haiku-20240307

2. Install AI SDK:
   npm install openai           # for OpenAI
   # or: npm install @anthropic-ai/sdk   # for Anthropic

3. Create services/ai.js:
   - AiService class:
     - constructor() → initialize AI client from env vars
     - async generateTemplate({ goal, audience, tone, mustHaves, context }) →
       - Build a system prompt for email template generation
       - Include context: workspace name, contact list type, user's business
       - Return: { subject, preheader, body, placeholders }
     - async suggestImprovements(templateBody) →
       - Analyze existing template and suggest improvements
       - Return: { suggestions: string[], improved: string }
   - Support both OpenAI and Anthropic APIs
   - If no API key configured, return helpful error message

4. Add AI generation to template creation flow:
   - On views/templates/new.ejs (or editor.ejs): prominent "Generate with AI" button
   - Clicking opens a form/modal:
     - Goal: text input ("Welcome new leads", "Re-engage cold prospects", etc.)
     - Audience: dropdown (from workspace's lists)
     - Tone: dropdown (Professional, Friendly, Urgent, Casual)
     - Must-haves: text input (key points to include)
   - Submit → POST /templates/generate → AI generates template → pre-fills editor

5. Add routes in routes/ai.js:
   - POST /templates/generate → call AiService.generateTemplate, return JSON
   - POST /templates/:id/improve → call AiService.suggestImprovements, return JSON
   - Mount: app.use('/ai', requireAuth, requireWorkspace, aiRoutes)

6. Add client-side JS for AI generation (public/js/ai-generate.js):
   - Handle form submit → fetch /templates/generate → populate editor fields
   - Show loading spinner while generating
   - Display errors if AI is not configured

7. Create tests/ai-service.test.js:
   - Test template generation returns expected structure
   - Test with REAL AI API call (only if API key is set, skip otherwise)
   - Test error handling when API key is missing
   - Test prompt construction includes context
   - Use REAL test database

VERIFY:
- npm start → Templates → New → "Generate with AI" → fill in goal/audience/tone → generate
- AI generates a real email template (with real API key)
- Template appears in editor, can be edited and saved
- Without API key: graceful error message
- npm test → all tests pass
```

---

### Step 14.2 — Guided Questions Wizard + Monalisa Suggestions

**Context:** AI template generation works with a simple form. Now add the guided questions wizard and Monalisa's suggested prompts.

```text
You are working on the pi-crm project. Step 14.1 is complete: AI template generation
via OpenAI/Anthropic is working.

TASK — Add guided questions wizard and suggested prompts:

1. Create the guided questions wizard (3–4 questions before AI generation):
   - Step 1: "What is the goal of this email?"
     - Options: Welcome/Intro, Follow-up, Re-engagement, Promotion, Update/Newsletter, Holiday/Event
     - Free-text alternative
   - Step 2: "Who is the audience?"
     - Auto-populated from workspace's lists
     - Option to describe custom audience
   - Step 3: "What tone do you want?"
     - Professional, Friendly, Casual, Urgent, Empathetic
   - Step 4: "Any must-have elements?"
     - Checkboxes: Call to action, Phone number, Meeting link, Testimonial, Discount/offer
     - Free-text for custom requirements

2. Create views/templates/ai-wizard.ejs:
   - Multi-step form with progress indicator
   - Each step on its own "page" (use JS to show/hide steps)
   - "Back" and "Next" buttons
   - Final step: "Generate" button
   - Clean Tailwind UI

3. Add Monalisa's Suggested Prompts sidebar:
   - When user is Monalisa (or any user in a real estate workspace):
     - Show a sidebar with pre-built prompt suggestions:
       - "Open house invitation"
       - "Just listed notification"
       - "Market update newsletter"
       - "New buyer welcome"
       - "Anniversary of home purchase"
       - "Holiday greetings to past clients"
     - Clicking a suggestion pre-fills the wizard with appropriate answers
   - Implementation: define suggestions in a config/ai-prompts.js file
   - Associate suggestions with workspace types/names

4. Create config/ai-prompts.js:
   - Export suggested prompts per workspace category:
     - 'real_estate': [...real estate prompts]
     - 'mortgage': [...mortgage prompts]
     - 'general': [...general prompts]
   - Each prompt: { title, goal, audience, tone, mustHaves }

5. Update routes:
   - GET /templates/ai-wizard → render wizard
   - POST /templates/ai-wizard → process wizard answers, generate, redirect to editor with result

6. Wire suggested prompts to the wizard:
   - Pass appropriate suggestions to the view based on workspace name/type
   - Click suggestion → auto-fills wizard fields

7. Create tests/ai-wizard.test.js:
   - Test wizard renders with correct steps
   - Test suggested prompts appear for real estate workspaces
   - Test generation with wizard answers produces template
   - Use REAL AI API (if key available) and REAL test database

VERIFY:
- npm start → Templates → AI Wizard → step through questions → generate
- As Monalisa in Coldwell Banker workspace → see real estate suggestions
- Click suggestion → wizard pre-filled → generate → template created
- npm test → all tests pass
```

---

### Step 14.3 — AI Insights on Dashboard

**Context:** AI template generation and wizard work. Now add the AI Insights section to the dashboard.

```text
You are working on the pi-crm project. Step 14.2 is complete: guided questions wizard
and suggested prompts are working.

TASK — Add AI Insights to the dashboard:

1. Update services/ai.js with insight generation:
   - AiService.generateInsights(userData) →
     - Analyze: template usage, campaign performance, contact engagement patterns
     - Return: array of insight objects { title, body, actionUrl, priority }
     - Example insights:
       - "Your 'Welcome' template has been used 15 times — consider creating a variation"
       - "12 contacts haven't been reached in 60+ days"
       - "Template 'Holiday Greeting' is similar to 'Season's Greetings' — consider consolidating"
   - Cache insights (regenerate at most once per day per user)

2. Create an insights cache table:
   CREATE TABLE IF NOT EXISTS ai_insights_cache (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     insights TEXT NOT NULL,
     generated_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (user_id) REFERENCES users(id)
   );

3. Update dashboard route (GET /):
   - Load cached insights for the user
   - If cache is older than 24 hours or empty:
     - Generate new insights (async, don't block dashboard load)
     - Save to cache
   - Pass insights to dashboard view

4. Update views/dashboard/index.ejs:
   - Replace the "AI Insights coming soon" placeholder
   - Show insight cards:
     - Title, description, "Take Action" link
     - "Dismiss" button (hides for this user)
     - Priority-based styling (high: amber border, normal: gray)
   - "Refresh Insights" button

5. Add an insight endpoint:
   - POST /ai/refresh-insights → regenerate insights, update cache
   - GET /ai/insights → return current insights as JSON

6. Add template performance tracking (basic):
   - Track: times used (count from campaigns), last used date
   - Query from campaigns and campaign_recipients tables
   - Feed this data into insight generation

7. Create tests/ai-insights.test.js:
   - Test insights are generated and cached
   - Test cache expires after 24 hours
   - Test insights include relevant data about templates/contacts
   - Test dismiss functionality
   - Use REAL AI API (if available) and REAL test database

VERIFY:
- npm start → dashboard shows AI insights section with real insights
- Insights are relevant to actual data (templates used, inactive contacts)
- "Refresh Insights" regenerates
- "Dismiss" hides an insight
- npm test → all tests pass
```

---

## Phase 15: Custom Fields

### Step 15.1 — Custom Field Definitions + Rendering

**Context:** All major features are built. Now add user-defined custom fields per workspace.

```text
You are working on the pi-crm project. Phase 14 is complete: AI template generation,
guided wizard, and dashboard insights are working.

TASK — Add custom fields per workspace:

1. Update config/database.js initDb() to create:
   CREATE TABLE IF NOT EXISTS custom_field_definitions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     workspace_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     field_type TEXT NOT NULL,
     options TEXT,
     sort_order INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
   );

   CREATE TABLE IF NOT EXISTS custom_field_values (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     contact_id INTEGER NOT NULL,
     field_id INTEGER NOT NULL,
     value TEXT,
     FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
     FOREIGN KEY (field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
     UNIQUE(contact_id, field_id)
   );

2. Create models/CustomField.js:
   - CustomField.createDefinition({ workspaceId, name, fieldType, options })
   - CustomField.getDefinitions(workspaceId) → list all field definitions
   - CustomField.updateDefinition(id, { name, options })
   - CustomField.deleteDefinition(id) → cascade deletes values
   - CustomField.setValue(contactId, fieldId, value)
   - CustomField.getValues(contactId) → all custom field values with definitions
   - CustomField.getValuesByWorkspace(workspaceId, contactId) → values joined with definitions

3. Add custom field management in workspace settings:
   - GET /settings/workspace/custom-fields → list/manage custom fields
   - POST /settings/workspace/custom-fields → create new field
   - POST /settings/workspace/custom-fields/:id/delete → delete field definition

4. Create views/settings/custom-fields.ejs:
   - List of existing custom fields: name, type, actions
   - Add form: name, type dropdown (text, date, dropdown, number, boolean), options (for dropdown: comma-separated values)
   - Delete button per field

5. Update contact forms (new, edit) to include custom fields:
   - Render custom fields dynamically based on workspace definitions
   - For each field type, render appropriate input:
     - text → text input
     - date → date picker
     - dropdown → select with defined options
     - number → number input
     - boolean → checkbox
   - Save custom field values when contact is created/updated

6. Update contact detail page:
   - Show custom fields in a "Custom Fields" section
   - Display values with appropriate formatting

7. Update Contact model:
   - After creating/updating a contact, save custom field values
   - When loading a contact, include custom field values

8. Create tests/custom-fields.test.js:
   - Test creating field definitions
   - Test setting and getting field values
   - Test rendering in contact forms
   - Test different field types (text, date, dropdown, boolean)
   - Test deleting definition cascades to values
   - Use REAL test database

VERIFY:
- npm start → workspace settings → add custom field "License Number" (text)
- Contact form shows the new custom field
- Fill in value → saves → shows on detail page
- Add dropdown field → options appear in select
- npm test → all tests pass
```

---

## Phase 16: Security, Backups & Deployment

### Step 16.1 — Input Validation + CSRF + API Keys

**Context:** All features are built. Now harden security across the application.

```text
You are working on the pi-crm project. Phase 15 is complete: custom fields per workspace
are working in contact forms and detail views.

TASK — Add security hardening:

1. Install security dependencies:
   npm install helmet csurf express-validator

2. Create middleware/security.js:
   - Add Helmet middleware for HTTP security headers
   - Add CSRF middleware using csurf:
     - Generate CSRF tokens for all forms
     - Add res.locals.csrfToken for views
     - Exclude API routes from CSRF (they use API keys)
   - Add rate limiting for login attempts (basic: max 5 per minute per IP)

3. Update ALL form views to include CSRF token:
   - Add <input type="hidden" name="_csrf" value="<%= csrfToken %>"> to every form
   - This includes: login, contacts, workspaces, lists, templates, campaigns, settings, etc.

4. Create middleware/validation.js:
   - Validation rules using express-validator for key routes:
     - Contact creation: first_name required, email format validation
     - Login: username and password required
     - Workspace: name required
     - Template: name and body required
   - Sanitize all text inputs (trim, escape HTML)
   - Return validation errors as flash messages

5. Apply validation to routes:
   - POST /login
   - POST /contacts
   - POST /workspaces
   - POST /templates
   - POST /campaigns

6. Implement API key authentication:
   - Create the api_keys table:
     CREATE TABLE IF NOT EXISTS api_keys (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       key_hash TEXT NOT NULL,
       name TEXT,
       last_used_at TEXT,
       created_at TEXT DEFAULT (datetime('now')),
       FOREIGN KEY (user_id) REFERENCES users(id)
     );
   - Create models/ApiKey.js:
     - ApiKey.generate(userId, name) → generate random key, hash it, store, return plain key (show once)
     - ApiKey.verify(key) → hash and look up, return associated user
     - ApiKey.revoke(id)
   - Create middleware/api-auth.js:
     - Check for X-API-Key header
     - Verify against api_keys table
     - Set req.user from associated user

7. Create routes/api.js:
   - API endpoints for external access:
     - GET /api/contacts → list contacts (requires API key + workspace header)
     - POST /api/contacts → create contact
     - GET /api/contacts/:id → get contact detail
   - Mount: app.use('/api', apiAuthMiddleware, apiRoutes)

8. Add API key management in user settings:
   - GET /settings/api-keys → list API keys, generate new
   - POST /settings/api-keys → generate new key (show key ONCE)
   - POST /settings/api-keys/:id/revoke → revoke key

9. Wire security middleware into app.js:
   - Helmet → first middleware
   - CSRF → after session, before routes
   - Pass csrfToken to all views via res.locals

10. Create tests/security.test.js:
    - Test CSRF: POST without token → 403
    - Test CSRF: POST with valid token → success
    - Test input validation: empty required fields → error
    - Test XSS: script tags in input are escaped
    - Test API key: valid key → access granted
    - Test API key: invalid key → 401
    - Test rate limiting: >5 login attempts → 429
    - Use REAL test database

VERIFY:
- npm start → all forms still work (CSRF tokens included)
- Invalid input shows validation errors
- API key generation and authentication work
- Script tags in input are escaped
- npm test → all tests pass
```

---

### Step 16.2 — Backup System + Health Monitoring

**Context:** Security hardening is complete. Now add the backup system and basic health monitoring.

```text
You are working on the pi-crm project. Step 16.1 is complete: CSRF, input validation,
API keys, and security headers are in place.

TASK — Add backup system and health monitoring:

1. Create services/backup.js:
   - BackupService.createBackup(targetDir) →
     - Use SQLite .backup command via better-sqlite3's backup() method
     - Save as: pi-crm-YYYYMMDD-HHmmss.db in targetDir
     - Return: { success, filePath, size }
   - BackupService.listBackups(targetDir) → list existing backups with dates and sizes
   - BackupService.pruneBackups(targetDir, keepCount) → delete oldest, keep last N
   - BackupService.restoreBackup(backupPath) →
     - DANGEROUS: stop accepting requests, copy backup over current db, restart
     - For now, just provide instructions (not automated in-app)

2. Add to .env and .env.example:
   BACKUP_DIR=./backups
   BACKUP_KEEP_COUNT=30
   S3_BUCKET=                    # Optional: iDrive/S3 bucket for off-site backup
   S3_ACCESS_KEY=
   S3_SECRET_KEY=
   S3_ENDPOINT=                  # For iDrive: endpoint URL

3. Create scripts/backup.sh (for cron):
   #!/bin/bash
   # Pi-CRM Backup Script
   # Add to crontab: 0 2 * * * /path/to/backup.sh
   cd /path/to/pi-crm
   node -e "require('./services/backup').createBackup(process.env.BACKUP_DIR || './backups')"
   # Optional: sync to S3
   # aws s3 sync ./backups s3://$S3_BUCKET/pi-crm-backups/

4. Add in-app backup trigger:
   - POST /settings/backup → trigger backup now
   - GET /settings/backups → list existing backups with dates and sizes
   - POST /settings/backup/:filename/download → download a backup file

5. Create views/settings/backups.ejs:
   - "Backup Now" button
   - List of existing backups: filename, date, size
   - Download link for each
   - Backup retention setting (keep last N)
   - Backup status: last backup date, next scheduled (from cron)

6. Create services/health.js:
   - HealthService.check() → returns status of:
     - Database: can query, size, table count
     - Disk space: available space on data partition
     - Last backup: date of most recent backup file
     - Alert if last backup > 48 hours old
   - HealthService.getAlerts() → return any warnings

7. Add health endpoint:
   - GET /api/health → public health check (no auth required)
     Returns: { status: 'ok', database: 'ok', lastBackup: '...', alerts: [] }

8. Add health status to dashboard:
   - Small status indicator: green (all ok), yellow (warnings), red (errors)
   - Click to see details

9. Create tests/backup.test.js:
   - Test backup creates a file
   - Test backup file is valid SQLite database
   - Test prune keeps correct number of backups
   - Test health check returns correct status
   - Use REAL test database and REAL file system

VERIFY:
- npm start → Settings → Backups → "Backup Now" → backup created
- Backup list shows files with sizes
- Download a backup → valid SQLite file
- /api/health returns status
- Dashboard shows health indicator
- npm test → all tests pass
```

---

### Step 16.3 — Deployment Configuration

**Context:** All features and security are complete. Now prepare for Raspberry Pi deployment.

```text
You are working on the pi-crm project. Step 16.2 is complete: backup system and health
monitoring are working.

TASK — Prepare deployment configuration for Raspberry Pi:

1. Create a production configuration:
   - config/production.js:
     - Trust proxy (for reverse proxy)
     - Secure cookies (when HTTPS is enabled)
     - Session settings for production
     - Logging configuration

2. Update app.js for production:
   - If NODE_ENV=production:
     - Enable trust proxy
     - Set secure cookies
     - Disable detailed error messages
     - Enable gzip compression (install compression: npm install compression)

3. Create scripts/deploy.sh:
   #!/bin/bash
   # Pi-CRM Deployment Script for Raspberry Pi
   # Usage: ./scripts/deploy.sh

   echo "Installing dependencies..."
   npm ci --production

   echo "Running database migrations..."
   node -e "require('./config/database').initDb()"

   echo "Seeding default data..."
   npm run seed

   echo "Setting up backup cron..."
   # Add cron job for daily backups at 2 AM

   echo "Starting application..."
   # Using pm2 for process management
   pm2 start server.js --name pi-crm

4. Create ecosystem.config.js for PM2:
   module.exports = {
     apps: [{
       name: 'pi-crm',
       script: 'server.js',
       env: { NODE_ENV: 'development' },
       env_production: { NODE_ENV: 'production' }
     }]
   };

5. Create docs/deployment-guide.md:
   - Prerequisites: Node.js 18+, Raspberry Pi OS
   - Installation steps
   - Environment configuration
   - Starting the app with PM2
   - Setting up HTTPS:
     - Option A: Let's Encrypt with Caddy/Nginx reverse proxy
     - Option B: Self-signed certificate
     - Option C: Cloudflare Tunnel
   - Firewall setup: ufw rules for LAN-only access
   - Backup cron setup
   - Monitoring and health checks
   - Troubleshooting common issues

6. Create a .env.production.example with all production settings:
   NODE_ENV=production
   PORT=3000
   DATABASE_PATH=./data/crm.db
   SESSION_SECRET=<generate-strong-secret>
   ENCRYPTION_KEY=<generate-strong-key>
   BCRYPT_ROUNDS=12
   BACKUP_DIR=./backups
   BACKUP_KEEP_COUNT=30
   # ... all other settings

7. Update package.json scripts:
   "start:prod": "NODE_ENV=production node server.js"

8. Add basic request logging for production:
   - Log: timestamp, method, path, status code, response time
   - Write to file in production, console in development

9. Create tests/production.test.js:
   - Test app starts in production mode
   - Test compression is enabled
   - Test health endpoint works
   - Test static assets are served
   - Use REAL test database

VERIFY:
- NODE_ENV=production npm start → app runs with production settings
- Compression enabled (check response headers)
- Health endpoint accessible
- Deployment guide is comprehensive and accurate
- npm test → all tests pass including production tests
```

---

## Final Wiring Checklist

After completing all 43 steps, verify end-to-end:

```text
FINAL INTEGRATION VERIFICATION — Run through the complete user journey:

1. Start the app: npm start
2. Login as Andy (andy / changeme123)
3. See dashboard with all widgets populated
4. Switch to "Loan Factory" workspace
5. Navigate to Contacts → Create a contact with all fields
6. Add secondary emails and phones
7. Assign to "Leads" list
8. View contact detail → see pinned notices, empty communication log
9. Send an email using a template → logged in communication log
10. Send an SMS → logged in communication log
11. Add a manual note → appears in log
12. Change stage from "Leads" to "Prospects" → auto-logged
13. Share contact with Monalisa
14. Navigate to Templates → Create with AI wizard
15. Create a campaign → select template → select recipients → send
16. Check dashboard → sent campaign appears
17. Navigate to Import/Export → export contacts → import a CSV
18. Settings → manage custom fields, configure email, manage API keys
19. Settings → trigger backup → verify backup created
20. Logout → login as Monalisa
21. See "Shared with Me" → Andy's shared contact visible (read-only)
22. "Save As" → copy to own workspace
23. Navigate to own workspace → create contacts, templates
24. Submit campaign in Loan Factory → goes to pending
25. Logout → login as Andy → approve the campaign
26. Check /api/health → returns OK
27. Run full test suite: npm test → all tests pass
```
