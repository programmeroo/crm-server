Here is the **comprehensive, final, self-contained project specification** for **pi-crm**.

This version is now **extremely detailed** — it includes every decision we refined over our multi-day conversation, with precise data models, API endpoints, validation rules, UI flows, edge cases, security considerations, deployment notes, testing approach, and implementation guidelines. It is written to be handed directly to a developer (or used to generate precise code-generation prompts).

# Pi-CRM – Comprehensive Final Project Specification

**Version**: 1.4 – Final  
**Date**: February 2026  
**Project name**: pi-server  
**App name**: pi-crm  
**Purpose**: A lightweight, home-use CRM for Andy and Monalisa to manage segmented contacts, communications, templates, campaigns, and AI-assisted workflows across multiple business lines and personal categories.  
**Target deployment**: Raspberry Pi running Ubuntu (low-resource, efficient design)  
**Core principles**:
- Minimal fixed schema (only 6 base contact fields)
- All additional contact data is dynamic custom fields via EAV
- Strict isolation between users and workspaces
- Object-oriented TypeScript (strict mode)
- API security via sessions (UI) + access keys (external/headless)
- AI integration for template/message generation, workflow execution, usage monitoring, and income/tool suggestions

## 1. Technology Stack & Tools

**Backend**  
- Language: TypeScript (strict: true, noImplicitAny: true)  
- Framework: Express.js  
- ORM: TypeORM (SQLite driver)  
- Database: SQLite (single file: `pi-crm.db`)  
- Authentication: express-session + connect-sqlite3 store  
- Password hashing: bcrypt  
- Validation: Joi  
- Logging: winston (console + file)  
- Error handling: Custom AppError class  
- Rate limiting: express-rate-limit  
- CSRF protection: csurf (forms)  
- API key security: custom middleware + api_keys table  
- Cron jobs: node-cron (backups, AI monitoring)  
- Image processing: sharp (template overlays)  

**Frontend**  
- Rendering: Server-Side Rendering with EJS  
- Styling: Tailwind CSS (CDN or bundled)  
- Client JS: Minimal (fetch for async actions, no heavy frameworks)  

**Dependencies** (package.json)

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
Foreign keys are `INTEGER` with `ON DELETE CASCADE` where appropriate.  
Timestamps use `TEXT DEFAULT (datetime('now'))`.

```sql
-- Users
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- API Keys
CREATE TABLE api_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key           TEXT UNIQUE NOT NULL,
  description   TEXT,
  scopes        TEXT NOT NULL,                  -- JSON array
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

-- Workspace Email Providers
CREATE TABLE workspace_email_providers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK(provider_type IN ('mailgun','google_workspace','microsoft_365')),
  config_json   TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id)
);

-- Base Contacts (only these 6 fixed fields)
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

-- Custom Fields (EAV)
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

-- Custom Field Definitions
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

-- Contact Lists
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

-- Campaign Approvals
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
  content       TEXT NOT NULL,                    -- JSON shape per type (documented below)
  timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT
);

-- AI Insights
CREATE TABLE ai_insights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  content       TEXT NOT NULL,
  confidence    REAL DEFAULT 0.5 CHECK(confidence BETWEEN 0 AND 1),
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Audit Logs
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
  scope_id      INTEGER,
  setting_key   TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(scope, scope_id, setting_key)
);
```

### Communication Log Content JSON Shapes (per type)

```json
{
  "email": {
    "subject": "string",
    "body": "string",
    "status": "sent|delivered|opened|bounced|failed",
    "opened_at": "timestamp|null",
    "clicked_links": ["url1", "url2"]
  },
  "text": {
    "message": "string",
    "status": "sent|delivered|undelivered|failed"
  },
  "call": {
    "duration_seconds": number,
    "notes": "string",
    "direction": "outbound|inbound"
  },
  "stage_change": {
    "old_list_name": "string",
    "new_list_name": "string"
  },
  "note": {
    "text": "string",
    "author": "user|system"
  },
  "ai": {
    "prompt": "string",
    "response": "string",
    "model": "string"
  },
  "system": {
    "message": "string",
    "event": "import|merge|backup|share"
  }
}
```

### Indexes

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

## 2. System Architecture & Conventions

**Folder Structure**

```text
src/
├── config/               # env parsing, constants
├── controllers/          # Express route handlers
├── entities/             # TypeORM entities
├── middlewares/          # auth, validation, error, api-key
├── repositories/         # TypeORM repository extensions
├── services/             # business logic
├── utils/                # helpers (logger, uuid, date, AI prompt builder)
├── views/                # EJS templates
├── migrations/           # TypeORM migrations
├── tests/                # Jest tests
├── app.ts                # entry point
├── types.ts              # shared types/interfaces
```

**Conventions**

- **TypeScript**: Strict mode, no `any`, explicit types/interfaces
- **OOP**: Constructor injection, interfaces for providers/services
- **Error handling**: `AppError` class with `code`, `status`, `message`; controllers catch → return `{ error: { code, message } }`
- **Response format**: `{ data: any, error: null | { code: string, message: string } }`
- **Logging**: winston (info for actions, error for failures)
- **Validation**: Joi for all inputs
- **Testing**: Jest + Supertest; tests first; real DB (in-memory for tests); real API calls (test keys/sandbox)
- **Session store**: connect-sqlite3 (persistent)
- **Foreign keys**: `PRAGMA foreign_keys = ON`
- **API security**: session for UI, `X-Api-Key` header for external (api_keys table)

## 3. Feature Requirements – Detailed

### 3.1 Authentication & Security

**Endpoints**  
- POST /api/auth/login { email, password } → set session.userId, return user  
- POST /api/auth/logout → destroy session  
- POST /api/auth/keys { description, scopes: string[], expiresInDays? } → generate key, return once  
- DELETE /api/auth/keys/:id → revoke  

**Middleware**  
- requireLogin: check session.userId  
- apiKeyMiddleware: check X-Api-Key, validate, attach req.user & req.apiScopes  
- workspaceBelongsToUser: check workspace.user_id === req.user.id  

**Audit Logging**  
- Log every mutation (create/update/delete) to audit_logs  
- Example: { user_id, action: "update_contact", entity_type: "contact", entity_id: 123, details: JSON }

### 3.2 Workspaces

**Endpoints**  
- GET /api/workspaces → list current user’s workspaces  
- POST /api/workspaces { name } → create  
- PUT /api/workspaces/:id { name }  
- DELETE /api/workspaces/:id (cascade deletes contacts, lists, templates, campaigns, etc.)  

**UI**  
- Sidebar: list workspaces + “New Workspace” button  
- Switching workspace → reload page with scoped data

### 3.3 Contact Lists

**Endpoints**  
- GET /api/workspaces/:wsId/lists → list  
- POST /api/lists { workspaceId, name, is_primary }  
- POST /api/lists/assign { contactId, listId, isPrimary? } → enforce one primary  
- DELETE /api/lists/assign { contactId, listId }  

**Behavior**  
- Primary list change → log "Primary List changed from X to Y" in communication log  
- Secondary lists used for filtering, tagging, segments

### 3.4 Contacts

**Endpoints**  
- POST /api/contacts { workspaceId, firstName, lastName, primaryEmail, primaryPhone, company }  
- GET /api/contacts?workspaceId=xx&page=1&limit=50&filter={email:"x"} → paginated base + custom  
- GET /api/contacts/:id → base + custom map  
- PUT /api/contacts/:id/base { firstName: "new" }  
- POST /api/contacts/:id/custom { fieldName: "business_phone", value: "555-1234", fieldType: "phone" }  
- GET /api/contacts/:id/custom → list  

**Custom Fields**  
- Defined in settings → per user or per workspace  
- UI: dynamic form on details page (loop definitions → render input by type)  
- Import/Export: custom fields as additional columns (field_name as header)  

**Duplicates**  
- Check primary_email OR primary_phone  
- Merge: POST /api/contacts/merge { sourceId, targetId, resolution: Record<string, 'source'|'target'|'custom'>, customValues?: Record<string, any> } → union custom, reassign lists, copy logs, delete source  

### 3.5 Communication Log & Pinned Notices

**Endpoints**  
- POST /api/logs { contactId, type, content, status? }  
- GET /api/contacts/:id/logs?type=…&page=… → paged, filtered by type  

**Pinned Notices**  
- Generated dynamically on details page  
- Examples: last email/campaign, shared status, bounces, pending AI drafts, upcoming custom date fields  

### 3.6 Templates

**Endpoints**  
- GET /api/templates?workspaceId=xx  
- POST /api/templates { workspaceId, name, subject, body_html, … }  
- POST /api/templates/generate { workspaceId, goal, audience, tone, mustHaves } → AI draft  

**AI Generation**  
- Wizard: goal, audience, tone, must-haves → pre-fill prompt  
- OpenAI call → save draft  
- Reuse: copy to workspace, share with Monalisa (read-only + Save As), Favorites Library  

**UI**  
- Templates page: list + “Generate with AI” → wizard → editor (rich text + image overlay)

### 3.7 Campaigns

**Endpoints**  
- POST /api/campaigns { workspaceId, type, templateId, segment_json, schedule_json }  
- POST /api/campaigns/:id/approve { status, notes } (Loan Factory only)  

**Loan Factory**  
- Custom campaigns → mandatory approval queue  
- Submit → pending → Andy reviews/approves/rejects  

**Recipient selection**  
- Whole list, filtered, manual, exclusions, saved/dynamic segments  
- Smart triggers: new prospect prompt, inactive 60+ days suggestion, broad holiday segments  

### 3.8 Email & Twilio

**Email Providers** (per workspace via workspace_email_providers table)  
- mailgun  
- google_workspace  
- microsoft_365  

**Twilio**  
- Single From number  
- Basic outbound + log replies  

### 3.9 AI Monitoring & Suggestions

**Endpoints**  
- GET /api/ai-insights → list for user  

**Behavior**  
- Hourly cron: analyze logs → generate template insights, income ideas → save to ai_insights  
- Focus: template performance, new tool/income ideas  
- Weekly email summary  

### 3.10 Dashboard

**Widgets (priority order)**  
1. Pending Approvals (Loan Factory)  
2. Activity Needing Attention (bounces, replies, stalled)  
3. Todos / Action Items  
4. Recent / Hot Leads  
5. Active & Upcoming Campaigns  
6. AI Insights  
7. Calendar (custom date fields)  
8. Quick Stats  

### 3.11 CSV Import/Export

**Endpoints**  
- GET /api/csv/export?workspaceId=xx → stream CSV (base + custom columns)  
- POST /api/csv/import { workspaceId } (multipart) → parse, map base, add custom  

### 3.12 Transactions / Loan File

- Custom field (field_name = "transaction_notes" or "loan_file_link")  
- Email references auto-logged in communication log  

### 3.13 Security & Backups

**Security**  
- Session for UI, `X-Api-Key` for external  
- Audit logging on all mutations  
- Rate limiting, CSRF, input sanitization  

**Backups**  
- Daily .backup via cron  
- Copy to external USB/NAS/cloud  
- In-app “Backup Now” button  

