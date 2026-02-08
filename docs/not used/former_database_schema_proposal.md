Here is the **final, detailed, programmer-ready specification** for pi-crm, now fully aligned with your requirements:

- Minimal base contact (only id, first_name, last_name, primary_email, primary_phone, company).
- **All** other fields are dynamic custom fields via EAV (no fixed birthday, marital status, kids, pets, notes, etc.).
- Business phone and alternate email are just examples of custom fields — nothing is special or pre-defined.
- Object-oriented Node.js design emphasized.
- API security with access keys added.
- AI interaction with the app expanded and detailed.

This spec is now comprehensive enough to serve as the single source of truth for building the app. It includes data models, validation, edge cases, API endpoints, UI flows, and implementation notes.

# Pi-CRM – Detailed Final Specification

**Version**: 1.2 (Final)  
**Purpose**: Home-use CRM for Andy & Monalisa to manage segmented contacts, communications, templates, campaigns, and AI-assisted workflows.  
**Stack**: Node.js (OOP), Express, TypeORM (SQLite), SSR + Tailwind CSS  
**Target**: Raspberry Pi (Ubuntu) – lightweight, low-resource design

## Core Principles

- Strict isolation: Each user’s data (workspaces, contacts, custom fields, etc.) is completely separate unless explicitly shared.
- Minimal base model: Only 6 fixed fields in base_contacts.
- All additional data is custom fields stored in EAV table.
- Custom fields are defined per user or per workspace via app UI.
- OOP throughout: Classes for models, services, controllers, providers.
- API security: Session for UI, access keys (API keys) for external/headless use.
- AI: Internal AiService class that interacts with app (create templates, execute workflows, monitor usage, generate insights).

## 1. Database Schema (SQLite)

```sql
-- Users (Andy & Monalisa)
CREATE TABLE users (
  id            TEXT PRIMARY KEY,  -- UUID
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- API Keys (for external / headless access)
CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY,  -- UUID
  user_id       TEXT NOT NULL REFERENCES users(id),
  key           TEXT UNIQUE NOT NULL,  -- UUID or random string
  description   TEXT,
  scopes        TEXT NOT NULL,         -- JSON array ["read:contacts", "write:campaigns"]
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at    TEXT,                    -- optional ISO date
  is_active     INTEGER DEFAULT 1
);

-- Workspaces
CREATE TABLE workspaces (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Base Contacts (only 6 fixed fields)
CREATE TABLE base_contacts (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  created_on      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_name      TEXT,
  last_name       TEXT,
  primary_email   TEXT,
  primary_phone   TEXT,
  company         TEXT,
  UNIQUE(workspace_id, primary_email) ON CONFLICT IGNORE,
  UNIQUE(workspace_id, primary_phone) ON CONFLICT IGNORE
);

-- Custom Fields (EAV – everything else)
CREATE TABLE custom_fields (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  workspace_id  TEXT REFERENCES workspaces(id),
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id),
  field_name    TEXT NOT NULL,        -- "alternate_email", "business_phone", "loan_file_link", etc.
  field_value   TEXT,                 -- string or JSON (e.g. {"label":"Business","value":"555-1234"})
  field_type    TEXT DEFAULT 'text',  -- text, date, number, url, phone, email, json, ...
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contact_id, field_name)
);

-- Custom Field Definitions (what fields can be used)
CREATE TABLE custom_field_definitions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  workspace_id  TEXT REFERENCES workspaces(id),  -- NULL = user-global
  field_name    TEXT NOT NULL,
  label         TEXT NOT NULL,        -- display name
  field_type    TEXT DEFAULT 'text',
  is_required   INTEGER DEFAULT 0,
  default_value TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id, field_name)
);

-- Contact Lists
CREATE TABLE contact_lists (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  name          TEXT NOT NULL,
  is_primary    INTEGER DEFAULT 0,    -- 1 = pipeline stage, 0 = tag/segment
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);

CREATE TABLE contact_list_assignments (
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id),
  list_id       TEXT NOT NULL REFERENCES contact_lists(id),
  assigned_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id, list_id)
);
```

## 2. Security & Authentication

- **UI Authentication**: Email + password (bcrypt hash). Session-based (express-session, secure cookies).
- **API Security**:  
  - **Access keys** for external/headless API use (e.g., AI callbacks, integrations).  
  - Table: `api_keys` (user-owned, scoped permissions).  
  - Header: `X-Api-Key: <key>`  
  - Middleware: `ApiKeyMiddleware` checks key, validates scopes, attaches user/workspace context.  
  - Scopes examples: "read:contacts", "write:contacts", "read:campaigns", "execute:ai-workflow".  
  - Creation: POST /api/keys { description, scopes } → generates key, returns once.  
  - Revoke: DELETE /api/keys/:id  
- Rate limiting: 100 req/min per IP/user (express-rate-limit).  
- CSRF protection on forms (csurf).  
- Audit logging: Every mutation logged to `audit_logs` (user_id, action, entity_id, timestamp).

## 3. Contacts & Custom Fields

**Base Contact**  
Only 6 fields in `base_contacts`. No other fixed fields exist.

**Custom Fields**  
- Everything else (alternate email, business phone, transaction notes, loan file link, birthday, referral source, etc.) is a custom field.  
- Defined in `custom_field_definitions` (per user or per workspace).  
- Stored in `custom_fields` (EAV).  
- UI:  
  - Contact Details: base form + dynamic section below (loop over definitions for that workspace/user).  
  - Settings → Custom Fields: list, add/edit/delete definitions (name, label, type, required).  
- Validation: Per field_type (e.g., phone → digits only, date → ISO format).  
- Edge cases:  
  - Delete definition → orphan values kept (warn user).  
  - Merge contacts → union custom fields; prompt on name conflicts.  
  - CSV import → map base; custom fields added only if definition exists.  

## 4. Communication Log

- Table: `communication_logs`  
- Columns: id, workspace_id, contact_id, type (enum: email, text, call, ai, stage_change, note, system), content (JSON), timestamp, status (sent/delivered/opened/bounced/etc.).  
- Auto-log: email send, text send, primary list change, custom field update (if transaction-related), AI action.  
- UI: Sections/tabs on Details page; pinned notices at top.

## 5. Templates & AI Interaction

**Templates**  
- Table: `templates` (id, workspace_id, name, subject, body_html, preheader, created_at).  
- Creation: AI-first (guided wizard → prompt → OpenAI → draft → edit).  
- Reuse: copy, share, Favorites Library.

**AI Interaction with App**  
- AiService class:  
  - `generateTemplate(workspaceId, promptData)` → OpenAI call → save draft.  
  - `createMarketingMessage(contactId, goal)` → generate + personalize.  
  - `executeWorkflow(templateId, action)` → e.g., send to Loan Factory approval (email via provider, log event).  
  - `monitorUsage()` → cron job: analyze logs → generate insights (templates, income ideas) → save to `ai_insights`.  
- Table: `ai_insights` (id, user_id, type, content, confidence, created_at).  
- UI: Dashboard “AI Insights” section; weekly email summary.

## 6. Campaigns

- Table: `campaigns` (id, workspace_id, name, type, template_id, segment_json, schedule_json, status).  
- Loan Factory: approval queue (campaign_approvals table).  
- Send: personalize via placeholders, send via provider, log per contact.

## 7. Email & Twilio

- Email: Per-workspace provider (Mailgun, Google Workspace, Microsoft 365).  
- Twilio: Single From number; log sent/received.

## 8. Dashboard & CSV

- Dashboard: prioritized widgets (approvals first).  
- CSV: base + custom fields as columns; simple mapping on import.

## 9. Security & Backups

- API keys: user-owned, scoped, header-validated.  
- Backups: daily .backup + external copy (cron).

---

