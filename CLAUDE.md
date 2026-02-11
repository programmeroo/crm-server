# Pi-CRM Project

**Purpose**: Home-use CRM for Andy & Monalisa to manage segmented contacts, communications, templates, campaigns, and AI-assisted workflows.
**Stack**: TypeScript, Node.js (OOP), Express, TypeORM (SQLite), SSR (EJS + Tailwind CDN), Jest + Supertest
**Target**: Raspberry Pi (Ubuntu) - lightweight, low-resource design
**Authoritative docs**: `docs/project-specification-v1-5.md` (schema + architecture), `docs/prompt-plan-v1-5.md` (implementation plan), `docs/project-spec-wireframes-v1-4.md` (UI design)

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
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- API Keys
CREATE TABLE api_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key           TEXT UNIQUE NOT NULL,
  description   TEXT,
  scopes        TEXT NOT NULL,                  -- JSON array
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at    TEXT,
  is_active     INTEGER DEFAULT 1
);

-- Workspaces
CREATE TABLE workspaces (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Base Contacts (v1.5: belongs to User, optionally Workspace)
CREATE TABLE base_contacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
  created_on      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_name      TEXT,
  last_name       TEXT,
  primary_email   TEXT,
  primary_phone   TEXT,
  company         TEXT,
  UNIQUE(user_id, primary_email),
  UNIQUE(user_id, primary_phone)
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
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);

CREATE TABLE contact_list_assignments (
  contact_id    INTEGER NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  list_id       INTEGER NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  is_primary    INTEGER DEFAULT 0,
  assigned_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id, list_id)
);

-- Templates (v1.5: INTEGER PKs, template_type field)
CREATE TABLE templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK(template_type IN ('html','text','mixed')) DEFAULT 'html',
  subject       TEXT,
  body          TEXT NOT NULL,
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
| 6 | Base Contacts (v1.5) | complete |
| 7 | Contact Lists | complete |
| 8 | Custom Fields (EAV) | complete |
| 9 | Prompts - Markdown File-Based | complete |
| 10 | Campaigns | complete |
| ... | ... | ... |
| 15 | Dashboard Layout & Auth Views | complete (matches wireframe) |
| 16 | Contact List & Detail Views | complete (matches wireframe) |
| 17 | Workspace List & Detail Views | complete (with list management) |

## UI State (Fully Implemented per Wireframe)

### Dashboard (`/`)
- **7 Sections**: Pending Approvals (red border), Activity Needing Attention (yellow border), Todos, Recent/Hot Leads (cards), Active Campaigns (with progress bars), AI Insights (compact), Quick Stats
- **Layout**: 3-column grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- **AI Insights**: Intentionally minimal - white bg, blue left border, shows 2 insights, "View All" link to `/ai-insights`

### Contacts List (`/contacts`)
- **Search**: Real-time filtering by name, email, phone, company
- **Filters**: Workspace dropdown, Primary List dropdown, Clear Filters button
- **Table Columns**: Name, Email, Phone, Company, Primary List, Last Contact, Actions
- **Action Icons**: Eye (view), Pencil (edit), Envelope (email)
- **Bulk Actions**: Toolbar appears when contacts selected - Send Email, Export Selected, Delete
- **Features**: Select All checkbox, Export CSV button, "New Contact" modal

### Contact Detail (`/contacts/:id`)
- **Base Info**: Edit modal with workspace assignment
- **Custom Fields**: "Manage Definitions" and "Edit Values" modals
- **Lists**: View assigned lists, "Add to List" modal (if workspace assigned), remove from list
- **Actions**: Edit contact, Delete contact, Email contact

### Workspace Detail (`/workspaces/:id`)
- **Lists Management**: "New List" button opens modal, create primary/secondary lists, delete lists (hover)
- **Contacts Table**: Shows contacts assigned to workspace
- **Stats**: Performance metrics card

### Workspaces List (`/workspaces`)
- Grid of workspace cards with contact counts

## Important Notes

- Prompt ordering differs between final_prompt_plan.md (correct) and updated_prompts_for_claude.md (old ordering). Always follow the numbering in the table above.
- Key differences from old prompt text: Audit Logging is Prompt 4 (not 18), Base Contacts is Prompt 6 before Contact Lists at Prompt 7, workspace_email_providers table exists for Prompt 13.
- NULL email/phone is allowed in base_contacts. Duplicate check only applies when values are present.
- Contact merge deletes source contact, reassigns lists, copies logs, unions custom fields. Resolution includes optional customValues map for 'custom' choices.
- Dashboard widgets: pending approvals, recent contacts, recent communications, AI insights, campaign status.
- **UI/UX Design Decisions**: Documented in `docs/project-specification-v1-5.md` section 3

## Deviations Log

Record any changes from the plan here as they happen during implementation.

- WSL bash commands require `wsl -d Ubuntu -- bash -ic "source ~/.nvm/nvm.sh && ..."` to load nvm/node
- express-rate-limit v7: `max: 0` blocks all requests (not disables). Skip middleware entirely in test mode instead.
- connect-sqlite3 has no @types — custom declaration at src/types/connect-sqlite3.d.ts
- Audit middleware uses req.originalUrl (not req.path) because Express sub-routers modify req.path
- Audit middleware captures session userId before routing since logout destroys session before res.json
- **UI Architecture**: Dashboard, Contacts, and Workspaces now use a global middleware in `app.ts` that provides `workspaces` (list) and `user` (name/email) to `res.locals`. This avoids duplicate fetches in every UI controller.
- **V1.5 Transition**: Successfully moved to `INTEGER PRIMARY KEY AUTOINCREMENT` for all tables.
- **Seeding & WSL**: WSL environment requires specific absolute paths for `sqlite3` and `ts-node` when triggered via Windows tasks. Use `scripts/seed_db.sh` for reliable seeding.
- **Custom Fields**: TypeORM null handling requires `IsNull()` import for workspace_id queries
- **List Management**: Added DELETE /api/lists/:id endpoint with workspace access verification
- **Contact Lists**: Full UI integration - workspace detail (create/delete), contact detail (add/remove), contacts list (filter by primary list)
- **Dashboard Design**: AI Insights intentionally compact (white bg, 2 insights max, "View All" link) - documented in project-specification-v1-5.md
- **Contacts List**: Fully redesigned to match wireframe - proper columns, filters, bulk actions, action icons
- **Testing Strategy**: Per user request, focus on app functionality first, defer test fixes (UUID→Integer conversion)
  - **tsconfig.json**: Updated to exclude test files from build: `"exclude": ["node_modules", "dist", "src/**/*.test.ts"]`
  - This allows app to build successfully despite failing tests (which will be fixed in future prompt)
- **Prompt 9: Prompts - Markdown File-Based**: Complete
  - Service: `PromptFileService.ts` - File I/O with gray-matter YAML frontmatter parsing
  - Controller (API): `PromptController.ts` - REST endpoints at `/api/prompts`
  - Controller (UI): `SettingsUIController.ts` - Manages `/settings` page with Prompts tab
  - Views: `views/settings/index.ejs` (main), `views/settings/prompt-detail.ejs` (edit)
  - File structure: `data/prompts/{workspaceId}/{listId|All Lists}/{slug}.md`
  - Architecture: Markdown files with YAML frontmatter (NOT database-backed)
  - Terminology: "All Lists" for workspace-wide prompts (not "Global")
  - List dropdown: Workspace-aware, fetches from ListService (not inferred from prompts)
  - Access control: Workspace-scoped verification in controller
  - Integration: Settings link in sidebar (gear icon), tabbed interface ready for future settings sections
  - Dependencies: Added `gray-matter` for YAML parsing

- **Prompt 10: Campaigns**: Complete
  - **Entities**:
    * `Campaign.entity.ts` - INTEGER PK, workspace-scoped, JSON columns (segment_json, schedule_json)
    * `CampaignApproval.entity.ts` - INTEGER PK, tracks approval status and reviewer info
  - **Service**: `CampaignService.ts` - Full CRUD + approval workflow
    * `create()` - Auto-sets status to 'pending' (+ approval record) ONLY if workspace.name === 'Loan Factory'
    * All other workspaces skip approval → status='draft' directly
    * `approveCampaign()`, `rejectCampaign()` - Approval workflow with reviewer tracking
    * `getPendingApprovalsForUser()` - Gets all pending campaigns across user's workspaces
    * `listByWorkspace()`, `findById()`, `update()`, `delete()` - Standard CRUD
  - **Controllers**:
    * `CampaignController.ts` (REST API) - 8 endpoints: pending-approvals, by-workspace, CRUD, approve/reject
    * `CampaignUIController.ts` (UI routes) - 7 routes: list, detail, create form, update, approve, reject, delete
  - **Views**:
    * `views/campaigns/index.ejs` - Card grid list with filters (status, type, workspace), search, create/approve/reject modals
    * `views/campaigns/create.ejs` - Multi-step form: workspace → details → template → recipients → schedule
    * `views/campaigns/detail.ejs` - Full campaign view with edit modals, approval section (Loan Factory only)
  - **Database Schema**:
    * `campaigns` table - Campaign records with types (one-off/scheduled/drip), JSON segment/schedule storage
    * `campaign_approvals` table - Approval tracking with status (pending/approved/rejected), reviewer_id, reviewed_at
  - **Business Logic**:
    * **Loan Factory-Specific**: Campaigns in "Loan Factory" workspace automatically get status='pending' + approval record
    * All other workspaces (Andy's other workspaces, Monalisa's workspaces) skip approval entirely
    * Workspace name check: `workspace.name === 'Loan Factory'` (not user-specific or workspace-type-specific)
  - **Access Control**: Workspace isolation - users can only create/view/approve campaigns in their own workspaces
  - **Dashboard Integration**: DashboardController updated to fetch real pending approvals from CampaignService
  - **App Integration**:
    * `CampaignService` instantiated in app.ts
    * `CampaignController` mounted at `/api/campaigns`
    * `CampaignUIController` mounted at `/campaigns`
  - **Key Features**:
    * Multi-step campaign creation form with Loan Factory warning banner
    * Campaign types: one-off, scheduled, drip
    * Recipient segmentation: whole list, filtered, manual selection (advanced options deferred to detail page)
    * Schedule types: immediate, one-time, drip sequences
    * Optional template selection during creation
    * Full CRUD via API and UI
    * Approval workflow with reviewer notes and timestamps
    * Dashboard widget shows real pending approvals (not hardcoded mock data)
  - **Testing**: Deferred per user request - test files excluded from build (tsconfig.json excludes *.test.ts)
  - **Routes**:
    * UI: GET /campaigns (list), GET /campaigns/new (create form), GET /campaigns/:id (detail)
    * UI: POST /campaigns (create), POST /campaigns/:id (update), DELETE /campaigns/:id
    * UI: POST /campaigns/:id/approve, POST /campaigns/:id/reject
    * API: GET /api/campaigns/pending-approvals, GET /api/campaigns/by-workspace/:workspaceId
    * API: POST/PUT/DELETE /api/campaigns/:id, POST /api/campaigns/:id/approve, POST /api/campaigns/:id/reject
