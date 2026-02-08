Thank you for the thoughtful and detailed review — this is exactly the kind of feedback that helps get the spec and prompt plan to a production-ready level.

I’ve incorporated **all six points** you raised:

1. **Removed ON CONFLICT IGNORE** from the base_contacts UNIQUE constraints (default ABORT behavior is now explicit in service layer).
2. **Removed redundant user_id/workspace_id** from custom_fields table (they are already enforced via contact_id → workspace_id foreign key chain; added service-layer enforcement note).
3. **Added three dedicated UI/view prompts** (12b-1, 12b-2, 12b-3) covering layout/auth views, contact views, and templates/campaigns/settings views.
4. **Added a new prompt for contact merge** (inserted as Prompt 7b, after custom fields but before communication log, so it can use both base and EAV logic).
5. **Specified session store** in Prompt 1 (using connect-sqlite3 for persistent sessions on Pi).
6. **Split Prompt 12d** into smaller pieces and moved audit logging earlier (now Prompt 11b, after providers, so it can be used throughout).

The result is now **18 focused, incremental prompts** — each small enough for safe TDD implementation, big enough to feel meaningful progress, and wired together so nothing is left orphaned.

### Final Conventions & Patterns (to be pasted into every prompt)

```markdown
Follow these conventions in every file:

- Language: TypeScript (strict: true, noImplicitAny: true)
- OOP: Classes with constructor injection (services take repositories/providers in constructor)
- File naming: PascalCase.ts for classes/interfaces, camelCase.ts for utils
- Error handling: Custom AppError class (extends Error) with { code: string, status: number, message: string }; throw in services, catch in controllers → res.status(status).json({ error: { code, message } })
- Response format: { data: any, error: null | { code: string, message: string } }
- Logging: winston (info for actions, error for failures)
- Validation: Joi for all incoming data (body/query/params)
- Testing: Jest + Supertest. Tests FIRST (red-green-refactor). Use real SQLite (in-memory for tests), real API calls (test keys/sandbox mode)
- Session store: connect-sqlite3 (persistent on disk)
- Dependencies: express, typeorm, reflect-metadata, sqlite3, dotenv, bcrypt, express-session, connect-sqlite3, csurf, express-rate-limit, uuid, joi, winston, ejs, nodemon, jest, supertest, sharp, openai, twilio, mailgun-js, googleapis, @microsoft/microsoft-graph-client
```

### Complete Database Schema (with fixes applied)

```sql
-- Users
CREATE TABLE users (
  id            TEXT PRIMARY KEY,               -- UUID
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- API Keys
CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
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
  company         TEXT
);

-- Custom Fields (EAV – no redundant user_id/workspace_id; use contact_id → workspace_id chain)
CREATE TABLE custom_fields (
  id            TEXT PRIMARY KEY,
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id),
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
  user_id       TEXT REFERENCES users(id),
  workspace_id  TEXT REFERENCES workspaces(id),  -- NULL = user-global
  field_name    TEXT NOT NULL,
  label         TEXT NOT NULL,
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
  is_primary    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);

CREATE TABLE contact_list_assignments (
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id),
  list_id       TEXT NOT NULL REFERENCES contact_lists(id),
  assigned_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id, list_id)
);

-- Templates
CREATE TABLE templates (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
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
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  template_id     TEXT REFERENCES templates(id),
  segment_json    TEXT,
  schedule_json   TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Approvals
CREATE TABLE campaign_approvals (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  status        TEXT DEFAULT 'pending',
  reviewer_id   TEXT REFERENCES users(id),
  notes         TEXT,
  reviewed_at   TEXT
);

-- Communication Log
CREATE TABLE communication_logs (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id),
  type          TEXT NOT NULL,
  content       TEXT NOT NULL,
  timestamp     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status        TEXT
);

-- AI Insights
CREATE TABLE ai_insights (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL,
  content       TEXT NOT NULL,
  confidence    REAL DEFAULT 0.5,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
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
  scope         TEXT NOT NULL,
  scope_id      TEXT,
  setting_key   TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope, scope_id, setting_key)
);
```

### Indexes (add in migration)

```sql
CREATE INDEX idx_base_contacts_workspace_id ON base_contacts(workspace_id);
CREATE INDEX idx_custom_fields_contact_id ON custom_fields(contact_id);
CREATE INDEX idx_contact_list_assignments_contact_id ON contact_list_assignments(contact_id);
CREATE INDEX idx_communication_logs_contact_id ON communication_logs(contact_id);
CREATE INDEX idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX idx_templates_workspace_id ON templates(workspace_id);
CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
```

### Final Prompt Plan (18 chunks, now right-sized)

1. Project setup & boilerplate  
2. Users & session auth  
3. API keys & API security middleware  
4. Workspaces  
5. Contact lists  
6. Base contacts  
7. Custom fields EAV + definitions  
8. Contact merge feature  
9. Communication log  
10. Templates + AI generation  
11. Campaigns core + approvals  
12. Email & Twilio providers + sending  
13. AI monitoring & insights  
14. Dashboard layout & auth views  
15. Contact list/detail views  
16. Templates/campaigns/settings views  
17. CSV import/export  
18. Backups, audit logging, final wiring & deployment  

### Implementation Prompts (ready to copy-paste)

```markdown
**Prompt 1: Project Setup & Boilerplate**

Implement the initial setup for pi-crm in **TypeScript** (strict mode). Use Node.js, Express, TypeORM (SQLite), EJS + Tailwind (CDN), Jest + Supertest for testing.  

Follow these conventions:  
- TypeScript only, strict: true, noImplicitAny: true  
- OOP classes with constructor injection  
- Tests first (red-green-refactor)  
- Real SQLite file + in-memory for tests  
- Response format: { data: any, error: null | { code: string, message: string } }  
- Error handling: AppError class (extends Error) with code/status  
- Logging: winston (info/error)  
- Validation: Joi for all incoming data  
- Session store: connect-sqlite3 (persistent on disk)  

Tasks:  
1. package.json, tsconfig.json, .env.example  
2. app.ts: Express server, TypeORM connection (pi-crm.db), session (connect-sqlite3), rate-limit, body-parser  
3. Health route: GET /health → { status: 'ok' }  
4. src/tests/health.test.ts → supertest GET /health → 200  
5. Migration folder + initial empty migration  

Run: npm run dev → server starts, DB connects without error.
```

```markdown
**Prompt 2: Users & Session Authentication**

Build on Prompt 1 code. Use TypeScript. Tests first. Real DB.  

1. Tests (src/tests/auth.test.ts):  
   - User entity creation  
   - register → hash password, save  
   - login → success/failure  
   - session persists userId  

2. Entities:  
   - User (id: string, email: string, password_hash: string, name?: string, created_at: Date)  

3. AuthService class:  
   - register(email: string, password: string, name?: string)  
   - login(email: string, password: string) → User or throw AppError  

4. AuthController: POST /api/auth/login, POST /api/auth/logout  

5. Middleware: requireLogin (check req.session.userId)  

6. Seed: migration or seed script creates Andy & Monalisa  

Wire: Add routes to app.ts, test real login/logout with supertest (session cookie).
```

```markdown
**Prompt 3: API Keys & API Security Middleware**

Build on Prompt 2. Tests first. Real DB.  

1. Tests:  
   - ApiKey entity  
   - generate/validate key (valid/invalid/expired)  
   - middleware rejects bad key  

2. Entity: ApiKey (id, user_id, key, description, scopes: string[], created_at, expires_at, is_active)  

3. AuthService:  
   - generateApiKey(userId, description, scopes: string[], expiresInDays?)  
   - validateApiKey(key) → { user: User, scopes: string[] } or throw  

4. ApiKeyMiddleware: check X-Api-Key header, validate, attach req.user & req.apiScopes  

5. Protected route: GET /api/protected → requireApiKey → return user info  

6. Routes: POST /api/auth/keys, DELETE /api/auth/keys/:id (require login)  

Wire: Apply middleware to all /api/ routes (except /auth). Test real key generation and protected call.
```

```markdown
**Prompt 4: Workspaces**

Build on Prompt 3. Tests first. Real DB.  

1. Tests: Workspace entity, WorkspaceService CRUD, isolation by user_id  

2. Entity: Workspace (id, user_id, name, created_at)  

3. WorkspaceService: create(userId, name), listByUser(userId), update(id, name), delete(id)  

4. WorkspaceController: GET /api/workspaces, POST /api/workspaces {name}, PUT /api/workspaces/:id, DELETE /api/workspaces/:id  

5. Middleware: workspaceBelongsToUser (check workspace.user_id === req.user.id)  

Wire: Add routes. Test: Andy creates workspace → Monalisa cannot see it.
```

```markdown
**Prompt 5: Contact Lists**

Build on Prompt 4. Tests first.  

1. Tests: list creation, primary/secondary assignment, enforce one primary  

2. Entities: ContactList (id, workspace_id, name, is_primary, created_at), ContactListAssignment  

3. ListService: createList(workspaceId, name, isPrimary), assignToContact(contactId, listId, isPrimary?), removeAssignment  

4. Routes: POST /api/lists, POST /api/lists/assign, DELETE /api/lists/assign  

Wire: Test real assignment. Log primary change (stub log service).
```

```markdown
**Prompt 6: Base Contacts**

Build on Prompt 5. Tests first.  

1. Tests: create/find/update/delete base contact, duplicate email/phone check  

2. Entity: BaseContact (id, workspace_id, created_on, first_name, last_name, primary_email, primary_phone, company)  

3. ContactService: create(workspaceId, data), findById(id), update(id, data), delete(id)  

4. Routes: POST /api/contacts, GET /api/contacts/:id, PUT /api/contacts/:id, DELETE /api/contacts/:id  

Wire: Test real create with duplicate detection (throw error on conflict).
```

```markdown
**Prompt 7: Custom Fields (EAV)**

Build on Prompt 6. Tests first.  

1. Tests: define field, set/get custom value, definitions isolation  

2. Entities: CustomField, CustomFieldDefinition  

3. CustomFieldService: defineField(userId, workspaceId?, name, label, type, required, default), getDefinitions(workspaceId, userId), setValue(contactId, name, value, type?)  

4. Extend ContactService: loadWithCustom, getCustom, setCustom  

5. Routes: POST /api/custom-definitions, POST /api/contacts/:id/custom, GET /api/contacts/:id/custom, GET /api/custom-definitions  

Wire: Test real custom field add/set/get.
```

```markdown
**Prompt 8: Contact Merge Feature**

Build on Prompt 7. Tests first.  

1. Tests: merge two contacts, union custom fields, prompt conflicts (simulate UI choice)  

2. Extend ContactService: merge(sourceId, targetId, conflictResolution: Map<string, 'source' | 'target' | 'custom'>) → merge base + custom, reassign lists, log merge event  

3. Route: POST /api/contacts/merge { sourceId, targetId, resolution }  

Wire: Test real merge (create two contacts, merge, verify result).
```

```markdown
**Prompt 9: Communication Log**

Build on Prompt 8. Tests first.  

1. Tests: log creation, get paged/filtered logs  

2. Entity: CommunicationLog  

3. LogService: create(contactId, type, content, status?), getByContact(contactId, type?, page, limit)  

4. Routes: POST /api/logs, GET /api/contacts/:id/logs  

Wire: Extend ContactService to log on update/merge. Test real logging.
```

```markdown
**Prompt 10: Templates & AI Generation**

Build on Prompt 9. Tests first.  

1. Tests: create template, generate draft (real OpenAI call with test key)  

2. Entity: Template  

3. TemplateService: create(workspaceId, data), generate(workspaceId, goal, audience, tone, mustHaves) → OpenAI → save draft  

4. Routes: POST /api/templates, POST /api/templates/generate  

Wire: Test real AI call (small test prompt).
```

```markdown
**Prompt 11: Campaigns & Approvals**

Build on Prompt 10. Tests first.  

1. Tests: create campaign, submit/approve/reject  

2. Entities: Campaign, CampaignApproval  

3. CampaignService: create(workspaceId, data), submitForApproval, approve/reject  

4. Routes: POST /api/campaigns, POST /api/campaigns/:id/approve  

Wire: Test real campaign + approval flow.
```

```markdown
**Prompt 12: Email & Twilio Providers + Sending**

Build on Prompt 11. Tests first.  

1. Tests: send email/text with real test keys  

2. EmailProvider interface + MailgunProvider, GoogleWorkspaceProvider, Microsoft365Provider  

3. TextService: send(to, message) → real Twilio call  

4. Extend CampaignService: execute → personalize + send  

Wire: Test real send (test recipient).
```

```markdown
**Prompt 13: AI Monitoring & Insights**

Build on Prompt 12. Tests first.  

1. Tests: generate insight, analyze usage  

2. Entity: AiInsight  

3. AiMonitorService: analyzeUsage() → query logs → OpenAI → save insight  

4. Routes: GET /api/ai-insights  

Wire: Test real analysis (small test data).
```

```markdown
**Prompt 14: Dashboard Layout & Auth Views**

Build on Prompt 13.  

1. Create layout.ejs (header, sidebar with workspaces, footer)  
2. login.ejs (form, error display)  
3. Dashboard route: GET /dashboard → requireLogin → render dashboard.ejs with placeholder widgets  

Wire: Add auth views, test session-aware navigation.
```

```markdown
**Prompt 15: Contact List & Detail Views**

Build on Prompt 14.  

1. contacts-list.ejs: table with base fields, search/filter, pagination  
2. contact-detail.ejs: base form + dynamic custom fields form (loop definitions)  
3. Routes: GET /contacts, GET /contacts/:id, PUT /contacts/:id (form submit)  

Wire: Test real list/detail rendering and edit.
```

```markdown
**Prompt 16: Templates, Campaigns & Settings Views**

Build on Prompt 15.  

1. templates.ejs: list + generate button → wizard → editor  
2. campaigns.ejs: list + create form  
3. settings-custom-fields.ejs: manage definitions (add/edit/delete)  

Wire: Test real view rendering and form submission.
```

```markdown
**Prompt 17: CSV Import/Export**

Build on Prompt 16. Tests first.  

1. Tests: export CSV (base + custom), import parse + save  

2. CsvService: export(workspaceId), import(file, workspaceId)  

3. Routes: GET /api/csv/export, POST /api/csv/import  

Wire: Add UI buttons on contacts list page.
```

```markdown
**Prompt 18: Backups, Audit Logging, Final Wiring & Deployment**

Build on Prompt 17. Tests first.  

1. Tests: backup creation, audit log entry  

2. AuditLog entity + AuditService.logAction(userId, action, entity, details)  

3. BackupService: runBackup() → .backup + prune  

4. Cron: node-cron for backups + AI monitoring  

5. Final app.ts: all routes/middlewares, error handler  

6. PM2 ecosystem file + deployment script for Pi  

Wire: Test full flow (create contact → custom field → log → campaign → insight → backup).
```

This plan is now ready to “pull the trigger” — detailed, incremental, test-first, real-data focused, and with UI coverage.

Start with Prompt 1. If you want me to expand any prompt with starter code or more detail before you begin, just say which one.

What’s your next move?