# Pi-CRM Implementation Blueprint

## Current State

The project has a basic Express.js skeleton with:
- Simple contact CRUD (name, email, last_contact)
- EJS templates with Tailwind CSS (CDN)
- SQLite database (`data/crm.db`) via `better-sqlite3`
- Placeholder pages (help, feedback, privacy, terms)
- No authentication, no workspaces, no advanced features

## Target Architecture

```
c:\LOCAL_PROJECTS\CRM-Server\
├── config/
│   ├── database.js          # Database connection & initialization
│   ├── session.js            # Session configuration
│   └── email-providers.js    # Email provider factory
├── middleware/
│   ├── auth.js               # Authentication guard
│   ├── workspace.js          # Workspace scoping
│   ├── csrf.js               # CSRF protection
│   └── validation.js         # Input sanitization
├── models/
│   ├── User.js
│   ├── Workspace.js
│   ├── Contact.js
│   ├── ContactEmail.js
│   ├── ContactPhone.js
│   ├── ContactList.js
│   ├── CommunicationLog.js
│   ├── Template.js
│   ├── Campaign.js
│   └── CustomField.js
├── routes/
│   ├── auth.js               # Login/logout
│   ├── dashboard.js          # Dashboard
│   ├── workspaces.js         # Workspace CRUD
│   ├── contacts.js           # Contact CRUD
│   ├── lists.js              # List management
│   ├── templates.js          # Template CRUD
│   ├── campaigns.js          # Campaign management
│   ├── sms.js                # Twilio SMS
│   ├── import-export.js      # CSV import/export
│   ├── sharing.js            # Contact sharing
│   ├── ai.js                 # AI features
│   ├── settings.js           # User/workspace settings
│   └── api.js                # API endpoints
├── services/
│   ├── email.js              # Email sending abstraction
│   ├── sms.js                # Twilio SMS service
│   ├── ai.js                 # AI service (OpenAI/Claude)
│   ├── backup.js             # Backup service
│   └── duplicate-detector.js # Duplicate contact detection
├── views/
│   ├── partials/
│   │   ├── header.ejs
│   │   ├── footer.ejs
│   │   ├── nav.ejs
│   │   ├── flash-messages.ejs
│   │   └── workspace-switcher.ejs
│   ├── auth/
│   │   └── login.ejs
│   ├── dashboard/
│   │   └── index.ejs
│   ├── workspaces/
│   │   ├── index.ejs
│   │   ├── new.ejs
│   │   └── edit.ejs
│   ├── contacts/
│   │   ├── index.ejs
│   │   ├── detail.ejs
│   │   ├── new.ejs
│   │   ├── edit.ejs
│   │   └── merge.ejs
│   ├── lists/
│   │   ├── index.ejs
│   │   └── view.ejs
│   ├── templates/
│   │   ├── index.ejs
│   │   ├── editor.ejs
│   │   └── preview.ejs
│   ├── campaigns/
│   │   ├── index.ejs
│   │   ├── new.ejs
│   │   ├── detail.ejs
│   │   └── approval.ejs
│   ├── import-export/
│   │   ├── export.ejs
│   │   └── import.ejs
│   └── settings/
│       ├── profile.ejs
│       └── workspace.ejs
├── public/
│   ├── css/
│   ├── js/
│   └── images/
├── tests/
│   ├── setup.js              # Test database setup
│   ├── auth.test.js
│   ├── workspaces.test.js
│   ├── contacts.test.js
│   ├── lists.test.js
│   ├── templates.test.js
│   ├── campaigns.test.js
│   ├── sms.test.js
│   ├── import-export.test.js
│   └── sharing.test.js
├── scripts/
│   ├── seed.js               # Seed default data
│   └── backup.sh             # Backup script
├── data/
│   └── crm.db
├── .env
├── .env.example
├── server.js                 # App entry point
├── app.js                    # Express app setup (separated for testing)
└── package.json
```

## Database Schema (Complete)

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Workspaces
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  email_provider TEXT,          -- 'google', 'mailgun', 'microsoft365'
  email_config TEXT,            -- JSON: encrypted credentials/settings
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Contact Lists
CREATE TABLE contact_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Contacts
CREATE TABLE contacts (
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

-- Contact Emails
CREATE TABLE contact_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Contact Phones
CREATE TABLE contact_phones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  label TEXT,                    -- 'Business', 'Personal', 'CA Mobile', etc.
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Contact Secondary List Assignments
CREATE TABLE contact_list_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  list_id INTEGER NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE,
  UNIQUE(contact_id, list_id)
);

-- Communication Log
CREATE TABLE communication_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,            -- 'email', 'sms', 'phone_call', 'ai_interaction',
                                 -- 'stage_change', 'note', 'system'
  direction TEXT,                -- 'inbound', 'outbound', NULL for system
  subject TEXT,
  body TEXT,
  metadata TEXT,                 -- JSON: campaign_id, provider response, etc.
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Templates
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  preheader TEXT,
  body TEXT NOT NULL,            -- HTML content
  placeholders TEXT,             -- JSON array of placeholder names
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Campaigns
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  template_id INTEGER,
  name TEXT NOT NULL,
  type TEXT NOT NULL,            -- 'immediate', 'scheduled', 'drip'
  status TEXT DEFAULT 'draft',   -- 'draft', 'pending_approval', 'approved',
                                 -- 'scheduled', 'sending', 'sent', 'rejected'
  schedule_at TEXT,
  drip_config TEXT,              -- JSON: steps with delays and conditions
  recipient_filter TEXT,         -- JSON: filter criteria
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

-- Campaign Recipients
CREATE TABLE campaign_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'bounced', 'opened', 'clicked'
  sent_at TEXT,
  metadata TEXT,                 -- JSON: provider response
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

-- Custom Field Definitions
CREATE TABLE custom_field_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,      -- 'text', 'date', 'dropdown', 'number', 'boolean'
  options TEXT,                  -- JSON: dropdown options
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Custom Field Values
CREATE TABLE custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  value TEXT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  UNIQUE(contact_id, field_id)
);

-- API Keys
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT,
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Session store table (for express-session with better-sqlite3-session-store)
CREATE TABLE sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired TEXT NOT NULL
);
```

---

## Phased Implementation Plan

### Phase 1: Foundation Refactor (Steps 1–3)

Restructure the project for scalability, add environment config, extract the database layer, and establish a testing framework.

| Step | Description | Builds On |
|------|------------|-----------|
| 1.1 | Environment config + project restructure + test framework setup | Existing code |
| 1.2 | Database module extraction + full schema creation | 1.1 |
| 1.3 | Separate app.js from server.js + verify all existing routes still work via tests | 1.2 |

### Phase 2: Authentication (Steps 4–6)

Add user accounts, login/logout, and route protection.

| Step | Description | Builds On |
|------|------------|-----------|
| 2.1 | User model + password hashing + seed script for Andy & Monalisa | 1.3 |
| 2.2 | Login/logout routes + session management + login view | 2.1 |
| 2.3 | Auth middleware protecting all routes + redirect to login + tests | 2.2 |

### Phase 3: Workspaces (Steps 7–9)

Multi-workspace support with scoped data access.

| Step | Description | Builds On |
|------|------------|-----------|
| 3.1 | Workspace model + CRUD routes + views | 2.3 |
| 3.2 | Workspace switcher in nav + scoping middleware | 3.1 |
| 3.3 | Seed default workspaces per user + integration tests | 3.2 |

### Phase 4: Contact Model Overhaul (Steps 10–13)

Replace the simple contacts table with the full schema.

| Step | Description | Builds On |
|------|------------|-----------|
| 4.1 | New contacts schema with all core fields + data migration | 3.3 |
| 4.2 | Contact emails & phones tables + models | 4.1 |
| 4.3 | Contact CRUD routes & views (workspace-scoped) | 4.2 |
| 4.4 | Contact detail page + duplicate detection on add | 4.3 |

### Phase 5: Contact Lists (Steps 14–16)

Primary/secondary list system with stage tracking.

| Step | Description | Builds On |
|------|------------|-----------|
| 5.1 | Contact lists model + CRUD + views | 4.4 |
| 5.2 | Primary list assignment + secondary tag lists + UI | 5.1 |
| 5.3 | Stage change auto-logging + tests | 5.2 |

### Phase 6: Communication Log & Notes (Steps 17–18)

Timeline view on contact detail.

| Step | Description | Builds On |
|------|------------|-----------|
| 6.1 | Communication log table + display on contact detail (tabs/filters) | 5.3 |
| 6.2 | Manual note entries + pinned notices at top of detail page | 6.1 |

### Phase 7: Contact Sharing (Steps 19–20)

Share contacts between Andy and Monalisa.

| Step | Description | Builds On |
|------|------------|-----------|
| 7.1 | Share/unshare toggle + "Shared with Me" view (read-only) | 6.2 |
| 7.2 | "Save As" to copy shared contact into own workspace + revoke | 7.1 |

### Phase 8: Templates (Steps 21–23)

Email template management.

| Step | Description | Builds On |
|------|------------|-----------|
| 8.1 | Template model + CRUD routes + list/create/edit views | 7.2 |
| 8.2 | Template editor with placeholders + live preview | 8.1 |
| 8.3 | Copy template to another workspace + share with other user | 8.2 |

### Phase 9: CSV Import/Export (Steps 24–25)

Data portability.

| Step | Description | Builds On |
|------|------------|-----------|
| 9.1 | CSV export from workspace or list view | 8.3 |
| 9.2 | CSV import with column mapping + duplicate handling | 9.1 |

### Phase 10: Email Integration (Steps 26–28)

Send real emails through configured providers.

| Step | Description | Builds On |
|------|------------|-----------|
| 10.1 | Email provider configuration model + workspace settings UI | 9.2 |
| 10.2 | Email sending service (Mailgun API + SMTP for Google/Microsoft) | 10.1 |
| 10.3 | Send email from contact detail + log in communication log | 10.2 |

### Phase 11: Campaigns (Steps 29–32)

Email campaign system.

| Step | Description | Builds On |
|------|------------|-----------|
| 11.1 | Campaign model + create one-off campaign + select template | 10.3 |
| 11.2 | Recipient selection (list, filter, manual, exclusions) | 11.1 |
| 11.3 | Campaign sending + scheduled campaigns (cron) | 11.2 |
| 11.4 | Drip sequences + Loan Factory approval workflow | 11.3 |

### Phase 12: Twilio SMS (Steps 33–34)

Text messaging integration.

| Step | Description | Builds On |
|------|------------|-----------|
| 12.1 | Twilio config + send SMS from contact detail page | 11.4 |
| 12.2 | SMS logging in communication log + bulk SMS from list | 12.1 |

### Phase 13: Dashboard (Steps 35–36)

Full dashboard with widgets.

| Step | Description | Builds On |
|------|------------|-----------|
| 13.1 | Dashboard layout: pending approvals, recent activity, todos | 12.2 |
| 13.2 | Active campaigns, quick stats, calendar/upcoming events | 13.1 |

### Phase 14: AI Features (Steps 37–39)

AI-powered template generation and insights.

| Step | Description | Builds On |
|------|------------|-----------|
| 14.1 | AI service config + template generation API endpoint | 13.2 |
| 14.2 | Guided questions wizard + generation UI on template create | 14.1 |
| 14.3 | AI Insights dashboard section + weekly summary | 14.2 |

### Phase 15: Custom Fields (Step 40)

User-defined fields per workspace.

| Step | Description | Builds On |
|------|------------|-----------|
| 15.1 | Custom field definitions + rendering on contact forms + detail view | 14.3 |

### Phase 16: Security, Backups & Deployment (Steps 41–43)

Production hardening.

| Step | Description | Builds On |
|------|------------|-----------|
| 16.1 | Input validation + CSRF protection + API key auth | 15.1 |
| 16.2 | Backup system (script + cron + in-app button) + health monitoring | 16.1 |
| 16.3 | Deployment: HTTPS, firewall, Raspberry Pi setup guide | 16.2 |

---

## Sizing Rationale

Each step is scoped to:
- **1–3 new files** created or modified
- **1 database table** introduced or migrated (at most)
- **Testable in isolation** with real database operations
- **Immediately wired** into the running application
- **No orphaned code** — every function, route, and view is connected by the end of the step

Steps build strictly forward: no step references code from a future step. Each prompt ends with verifying the feature works end-to-end in the browser and in tests.
