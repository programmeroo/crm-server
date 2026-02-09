# Pi-CRM Project

**Purpose**: Home-use CRM for Andy & Monalisa to manage segmented contacts, communications, templates, campaigns, and AI-assisted workflows.
**Stack**: TypeScript, Node.js (OOP), Express, TypeORM (SQLite), SSR (EJS + Tailwind CDN), Jest + Supertest
**Target**: Raspberry Pi (Ubuntu) - lightweight, low-resource design
**Authoritative docs**: `docs/final_prompt_plan.md` (schema + plan), `docs/updated_prompts_for_claude.md` (prompt text)

## Conventions (follow exactly in every file)

- Language: TypeScript (strict: true, noImplicitAny: true, no `any`)
- OOP: Classes with constructor injection (services take repositories/providers)
- File naming: PascalCase.ts for classes/interfaces, camelCase.ts for utils
- Error handling: AppError class (extends Error) with { code: string, status: number, message: string }; throw in services, catch in controllers -> res.status(status).json({ error: { code, message } })
- Response format: { data: any, error: null | { code: string, message: string } }
- Logging: winston (info for actions, error for failures)
- Validation: Joi for all incoming data
- Testing: Jest + Supertest. Tests FIRST (red-green-refactor). Use real SQLite (file + in-memory for tests), real API calls (test keys/sandbox mode)
- Session store: connect-sqlite3 (persistent)
- Foreign keys: PRAGMA foreign_keys = ON in connection options
- Dependencies: express, typeorm, reflect-metadata, sqlite3, dotenv, bcrypt, express-session, connect-sqlite3, csurf, express-rate-limit, uuid, joi, winston, ejs, nodemon, jest, supertest, sharp, openai, twilio, mailgun-js, googleapis, @microsoft/microsoft-graph-client, node-cron

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- API Keys
CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key           TEXT UNIQUE NOT NULL,
  description   TEXT,
  scopes        TEXT NOT NULL,                  -- JSON array
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at    TEXT,
  is_active     INTEGER DEFAULT 1
);

-- Workspaces
CREATE TABLE workspaces (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Base Contacts (only 6 fixed fields)
CREATE TABLE base_contacts (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_on      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  id            TEXT PRIMARY KEY,
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  field_name    TEXT NOT NULL,
  field_value   TEXT,
  field_type    TEXT DEFAULT 'text',
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contact_id, field_name)
);

-- Custom Field Definitions
CREATE TABLE custom_field_definitions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = user-global
  field_name    TEXT NOT NULL,
  label         TEXT NOT NULL,
  field_type    TEXT DEFAULT 'text',
  is_required   INTEGER DEFAULT 0,
  default_value TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id, field_name)
);

CREATE UNIQUE INDEX idx_cfd_user_global ON custom_field_definitions(user_id, field_name)
WHERE workspace_id IS NULL;

-- Contact Lists
CREATE TABLE contact_lists (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_primary    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);

CREATE TABLE contact_list_assignments (
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  list_id       TEXT NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  assigned_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id, list_id)
);

-- Templates
CREATE TABLE templates (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  subject       TEXT,
  body_html     TEXT NOT NULL,
  preheader     TEXT,
  signature     TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);

-- Campaigns
CREATE TABLE campaigns (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  template_id     TEXT REFERENCES templates(id) ON DELETE SET NULL,
  segment_json    TEXT,
  schedule_json   TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Approvals
CREATE TABLE campaign_approvals (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending',
  reviewer_id   TEXT REFERENCES users(id),
  notes         TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   TEXT
);

-- Communication Log
CREATE TABLE communication_logs (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK(type IN ('email','text','call','ai','stage_change','note','system')),
  content       TEXT NOT NULL,                    -- JSON shape per type:
  -- email: {"subject": "...", "body": "...", "status": "sent|delivered|opened|bounced", "opened_at": "..."}
  -- text: {"message": "...", "status": "sent|delivered|undelivered"}
  -- call: {"duration": 120, "notes": "..."}
  -- stage_change: {"old_list": "Leads", "new_list": "Prospects"}
  -- note: {"text": "..."}
  -- ai: {"prompt": "...", "response": "..."}
  -- system: {"message": "..."}
  timestamp     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status        TEXT
);

-- AI Insights
CREATE TABLE ai_insights (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  content       TEXT NOT NULL,
  confidence    REAL DEFAULT 0.5,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  details       TEXT,
  ip_address    TEXT,
  timestamp     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE system_settings (
  id            TEXT PRIMARY KEY,
  scope         TEXT NOT NULL,                    -- global / user / workspace
  scope_id      TEXT,
  setting_key   TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope, scope_id, setting_key)
);

-- Workspace Email Providers (per-workspace config)
CREATE TABLE workspace_email_providers (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,                    -- "mailgun", "google_workspace", "microsoft_365"
  config_json   TEXT NOT NULL,                    -- {"api_key": "..."} or {"client_id": "...", ...}
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id)
);
```

## Indexes

```sql
CREATE INDEX idx_base_contacts_workspace_id ON base_contacts(workspace_id);
CREATE INDEX idx_custom_fields_contact_id ON custom_fields(contact_id);
CREATE INDEX idx_contact_list_assignments_contact_id ON contact_list_assignments(contact_id);
CREATE INDEX idx_communication_logs_contact_id ON communication_logs(contact_id);
CREATE INDEX idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX idx_templates_workspace_id ON templates(workspace_id);
CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX idx_workspace_email_providers_workspace_id ON workspace_email_providers(workspace_id);
```

## Implementation Plan (18 prompts)

| # | Prompt | Status |
|---|--------|--------|
| 1 | Setup & Boilerplate | complete |
| 2 | Users & Session Auth | complete |
| 3 | API Keys & Security Middleware | complete |
| 4 | Audit Logging (cross-cutting) | complete |
| 5 | Workspaces | complete |
| 6 | Base Contacts | not started |
| 7 | Contact Lists | not started |
| 8 | Custom Fields (EAV) | not started |
| 9 | Contact Merge | not started |
| 10 | Communication Log | not started |
| 11 | Templates & AI Generation | not started |
| 12 | Campaigns & Approvals | not started |
| 13 | Email & Twilio Providers + Sending | not started |
| 14 | AI Monitoring & Insights | not started |
| 15 | Dashboard Layout & Auth Views | not started |
| 16 | Contact List & Detail Views | not started |
| 17 | Templates, Campaigns & Settings Views | not started |
| 18 | CSV Import/Export, Backups, Final Wiring & Deployment | not started |

## Important Notes

- Prompt ordering differs between final_prompt_plan.md (correct) and updated_prompts_for_claude.md (old ordering). Always follow the numbering in the table above.
- Key differences from old prompt text: Audit Logging is Prompt 4 (not 18), Base Contacts is Prompt 6 before Contact Lists at Prompt 7, workspace_email_providers table exists for Prompt 13.
- NULL email/phone is allowed in base_contacts. Duplicate check only applies when values are present.
- Contact merge deletes source contact, reassigns lists, copies logs, unions custom fields. Resolution includes optional customValues map for 'custom' choices.
- Dashboard widgets: pending approvals, recent contacts, recent communications, AI insights, campaign status.

## Deviations Log

Record any changes from the plan here as they happen during implementation.

- WSL bash commands require `wsl -d Ubuntu -- bash -ic "source ~/.nvm/nvm.sh && ..."` to load nvm/node
- express-rate-limit v7: `max: 0` blocks all requests (not disables). Skip middleware entirely in test mode instead.
- connect-sqlite3 has no @types — custom declaration at src/types/connect-sqlite3.d.ts
- Audit middleware uses req.originalUrl (not req.path) because Express sub-routers modify req.path
- Audit middleware captures session userId before routing since logout destroys session before res.json
