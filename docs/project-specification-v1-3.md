Here is the **complete, extremely detailed, final version** of the **Pi-CRM Project Specification**.

This is a single, self-contained document that a developer can use to build the entire application. It reflects every decision we've made, with all your latest requirements applied:

- Primary keys are **INTEGER AUTOINCREMENT** on every table
- Only **six fixed fields** in the base contact table
- All other contact data is **purely custom fields** via EAV (no predefined birthday, marital status, kids, pets, notes, etc.)
- Business phone and alternate email are **just examples** of custom fields — nothing is special
- Full object-oriented Node.js design (TypeScript, strict mode)
- API security via access keys
- AI interaction with the app (template generation, workflow execution, monitoring)
- Comprehensive schema, API endpoints, validation rules, edge cases, conventions, and implementation notes

# Pi-CRM – Final Project Specification

**Version**: 1.3 – Final  
**Date**: February 2026  
**Purpose**: A lightweight, home-use CRM for Andy and Monalisa to manage segmented contacts, communications, templates, campaigns, and AI-assisted workflows across multiple business lines and personal categories.  
**Target deployment**: Raspberry Pi running Ubuntu (low-resource, efficient design)  
**Core philosophy**: Minimal fixed schema + extreme flexibility via EAV custom fields; strong isolation between users and workspaces; object-oriented code structure.

## 1. Technology Stack & Tools

**Backend**  
- Language: **TypeScript** (strict mode: true, noImplicitAny: true)  
- Framework: Express.js  
- ORM: TypeORM (SQLite driver)  
- Database: SQLite (single file: `pi-crm.db`)  
- Authentication: express-session + connect-sqlite3 store (persistent sessions)  
- Password hashing: bcrypt  
- Validation: Joi  
- Logging: winston (console + file transport)  
- Error handling: Custom AppError class  
- Rate limiting: express-rate-limit  
- CSRF protection: csurf (for forms)  
- API key security: custom middleware + api_keys table  
- Cron jobs: node-cron (for backups, AI monitoring)  

**Frontend**  
- Rendering: Server-Side Rendering with EJS  
- Styling: Tailwind CSS (via CDN or bundled)  
- Client-side JS: Minimal (fetch for async, no heavy frameworks)  

**Dependencies** (package.json excerpt)

```json
{
  "dependencies": {
    "express": "^4.19.2",
    "typeorm": "^0.3.20",
    "sqlite3": "^5.1.7",
    "reflect-metadata": "^0.2.2",
    "dotenv": "^16.4.5",
    "bcrypt": "^5.1.1",
    "express-session": "^1.18.0",
    "connect-sqlite3": "^0.9.5",
    "csurf": "^1.11.0",
    "express-rate-limit": "^7.4.0",
    "uuid": "^10.0.0",
    "joi": "^17.13.3",
    "winston": "^3.13.1",
    "ejs": "^3.1.10",
    "sharp": "^0.33.5",
    "openai": "^4.0.0",
    "twilio": "^5.3.0",
    "mailgun-js": "^0.22.0",
    "googleapis": "^144.0.0",
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.10",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.5.3",
    "nodemon": "^3.1.4"
  }
}
```

**tsconfig.json** (key settings)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## 2. Database Schema (Complete)

All primary keys are `INTEGER PRIMARY KEY AUTOINCREMENT`.  
Foreign keys use `INTEGER` and `ON DELETE CASCADE` where appropriate.  
Timestamps use `TEXT DEFAULT (datetime('now'))` for consistency.

```sql
-- Users (Andy & Monalisa)
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- API Keys (for external / headless / AI access)
CREATE TABLE api_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key           TEXT UNIQUE NOT NULL,
  description   TEXT,
  scopes        TEXT NOT NULL,                  -- JSON array ["read:contacts", "write:campaigns"]
  created_at    TEXT DEFAULT (datetime('now')),
  expires_at    TEXT,
  is_active     INTEGER DEFAULT 1
);

-- Workspaces
CREATE TABLE workspaces (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

-- Workspace Email Providers (one per workspace)
CREATE TABLE workspace_email_providers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK(provider_type IN ('mailgun','google_workspace','microsoft_365')),
  config_json   TEXT NOT NULL,  -- JSON: {"api_key":"…"} or {"client_id":"…","client_secret":"…"}
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id)
);

-- Base Contacts (only these 6 fixed fields – everything else is custom)
CREATE TABLE base_contacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id    INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_on      TEXT NOT NULL DEFAULT (datetime('now')),
  first_name      TEXT,
  last_name       TEXT,
  primary_email   TEXT,
  primary_phone   TEXT,
  company         TEXT,
  UNIQUE(workspace_id, primary_email),
  UNIQUE(workspace_id, primary_phone)
);

-- Custom Fields (EAV – all other contact data)
CREATE TABLE custom_fields (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id    INTEGER NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  field_name    TEXT NOT NULL,
  field_value   TEXT,
  field_type    TEXT DEFAULT 'text',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(contact_id, field_name)
);

-- Custom Field Definitions (what fields are allowed/expected)
CREATE TABLE custom_field_definitions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = user-global
  field_name    TEXT NOT NULL,
  label         TEXT NOT NULL,
  field_type    TEXT DEFAULT 'text',
  is_required   INTEGER DEFAULT 0,
  default_value TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, workspace_id, field_name)
);

CREATE UNIQUE INDEX idx_cfd_user_global 
ON custom_field_definitions(user_id, field_name) 
WHERE workspace_id IS NULL;

-- Contact Lists (primary stages + secondary tags/segments)
CREATE TABLE contact_lists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_primary    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, name)
);

CREATE TABLE contact_list_assignments (
  contact_id    INTEGER NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  list_id       INTEGER NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  assigned_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (contact_id, list_id)
);

-- Templates
CREATE TABLE templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  subject       TEXT,
  body_html     TEXT NOT NULL,
  preheader     TEXT,
  signature     TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, name)
);

-- Campaigns
CREATE TABLE campaigns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id    INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('one-off','scheduled','drip')),
  template_id     INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  segment_json    TEXT,
  schedule_json   TEXT,
  status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending','active','completed','paused')),
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Campaign Approvals (Loan Factory only)
CREATE TABLE campaign_approvals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewer_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  reviewed_at   TEXT
);

-- Communication Log
CREATE TABLE communication_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id    INTEGER NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK(type IN ('email','text','call','ai','stage_change','note','system')),
  content       TEXT NOT NULL,                    -- JSON shape per type:
  -- email:   {"subject":"…", "body":"…", "status":"sent|delivered|opened|bounced", "opened_at":"…", "clicked_links":[]}
  -- text:    {"message":"…", "status":"sent|delivered|undelivered|failed"}
  -- call:    {"duration_seconds":120, "notes":"…", "direction":"outbound|inbound"}
  -- stage_change: {"old_list_name":"Leads", "new_list_name":"Prospects"}
  -- note:    {"text":"…", "author":"user|system"}
  -- ai:      {"prompt":"…", "response":"…", "model":"claude-3.5-sonnet"}
  -- system:  {"message":"…", "event":"import|merge|backup"}
  timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT
);

-- AI Insights / Suggestions
CREATE TABLE ai_insights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  content       TEXT NOT NULL,
  confidence    REAL DEFAULT 0.5 CHECK(confidence BETWEEN 0 AND 1),
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Audit Logs (security tracking)
CREATE TABLE audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     INTEGER,
  details       TEXT,
  ip_address    TEXT,
  timestamp     TEXT DEFAULT (datetime('now'))
);

-- System / User / Workspace Settings
CREATE TABLE system_settings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scope         TEXT NOT NULL CHECK(scope IN ('global','user','workspace')),
  scope_id      INTEGER,  -- user_id or workspace_id or NULL for global
  setting_key   TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(scope, scope_id, setting_key)
);
```

### Indexes (add in migration)

```sql
CREATE INDEX idx_base_contacts_workspace_id    ON base_contacts(workspace_id);
CREATE INDEX idx_custom_fields_contact_id      ON custom_fields(contact_id);
CREATE INDEX idx_contact_list_assignments_cid  ON contact_list_assignments(contact_id);
CREATE INDEX idx_communication_logs_contact_id ON communication_logs(contact_id);
CREATE INDEX idx_campaigns_workspace_id        ON campaigns(workspace_id);
CREATE INDEX idx_templates_workspace_id        ON templates(workspace_id);
CREATE INDEX idx_ai_insights_user_id           ON ai_insights(user_id);
CREATE INDEX idx_workspace_email_providers_wid ON workspace_email_providers(workspace_id);
```

### System Architecture & Conventions

**Backend Structure** (src/)

```text
src/
├── config/               # env parsing, constants
├── controllers/          # Express route handlers
├── entities/             # TypeORM entity classes
├── middlewares/          # auth, validation, error, api-key
├── repositories/         # TypeORM repository extensions
├── services/             # Business logic (ContactService, AiService, etc.)
├── utils/                # helpers (logger, uuid, date utils)
├── views/                # EJS templates
├── migrations/           # TypeORM migration files
├── tests/                # Jest tests
├── app.ts                # Express server entry
├── types.ts              # shared types/interfaces
```

**Conventions**

- **TypeScript**: Strict mode, no `any`, explicit types/interfaces
- **Error handling**: Throw `AppError` with `code`, `status`, `message`; controllers catch and return `{ error: { code, message } }`
- **Responses**: `{ data: any, error: null | { code: string, message: string } }`
- **Logging**: winston (info for actions, error for exceptions)
- **Validation**: Joi schemas for all inputs
- **Testing**: Jest + Supertest; tests first; real DB (in-memory for tests); real API calls (test keys)
- **Foreign keys**: `PRAGMA foreign_keys = ON` in connection
- **Session**: connect-sqlite3 store (persistent on disk)
- **API security**: Session for UI, `X-Api-Key` header for external access (api_keys table)

### Detailed Feature Requirements

**Authentication & Security**

- Login: POST /api/auth/login { email, password } → set session.userId
- Logout: POST /api/auth/logout
- API keys: POST /api/auth/keys { description, scopes } → generate key (once)
- DELETE /api/auth/keys/:id (revoke)
- Middleware: requireLogin (UI), apiKeyMiddleware (API)

**Workspaces**

- CRUD per user
- Current workspace stored in session
- Email provider config per workspace (workspace_email_providers table)

**Contacts**

- Base: only 6 fields
- Custom: EAV via custom_fields + definitions
- Duplicates: service-layer check on primary_email/phone; throw on conflict
- Merge: POST /api/contacts/merge { sourceId, targetId, resolution: Record<string, 'source'|'target'|'custom'> } → union custom, reassign lists, copy logs, delete source

**Communication Log**

- Auto-log on mutations (create/update contact, send email/text, change list, AI action)
- content JSON shape per type documented above

**Templates**

- AI generation: wizard → prompt → OpenAI → draft → save
- Reuse: copy, share, favorites

**Campaigns**

- Types: one-off, scheduled, drip
- Loan Factory: mandatory approval queue
- Sending: personalize via placeholders, send via workspace provider

**AI Interaction**

- Generate templates/messages
- Execute workflows (e.g. send template for approval)
- Monitor usage → generate insights (stored in ai_insights)

**Dashboard**

Widgets (in priority order):  
1. Pending Approvals (Loan Factory)  
2. Activity Needing Attention (bounces, unread replies, stalled contacts)  
3. Todos / Action Items  
4. Recent / Hot Leads  
5. Active & Upcoming Campaigns  
6. AI Insights  
7. Calendar (custom date fields)  
8. Quick Stats (contact count, campaign count, etc.)

**CSV**

- Export: base + custom fields as columns
- Import: map base, add custom if definition exists

**Backups**

- Daily .backup via cron
- Copy to external folder/cloud
- In-app “Backup Now” button

