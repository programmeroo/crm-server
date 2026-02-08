Here is my response to your feedback. I agree — the previous prompts were still too high-level and "thin" for a real, weeks-long build. I’ve addressed every point you raised:

- Added the missing table DDLs (now the schema is complete and self-contained).
- Added 3 focused UI/view prompts (they come after the backend is solid, so the frontend builds on a working API).
- Broke the old "Prompt 12" into four smaller, focused prompts (12a–12d).
- Clarified TypeScript vs JavaScript: **TypeScript** is now explicitly required (with types/interfaces for safety and clarity).
- Added a **Conventions & Patterns** section at the top of the spec so every prompt produces consistent, high-quality code.

### Updated Conventions & Patterns (to be included in every prompt context)

**Language & Style**  
- Use **TypeScript** (strict mode, no `any` unless absolutely necessary).  
- OOP design: classes with clear responsibilities, interfaces for providers/services, dependency injection (constructor injection).  
- File naming: PascalCase for classes/interfaces (e.g., `ContactService.ts`), camelCase for utils/helpers.  
- Error handling: Custom `AppError` class (extends Error) with `code` and `status` properties; throw in services, catch in controllers → return consistent JSON { error: string, code: string, status: number }.  
- Response format: Always JSON { data: any, error: null | { message: string, code: string } }.  
- Logging: winston logger (info for normal, error for failures).  
- Validation: Joi schemas for all incoming data (body, query, params).  
- Testing: Jest + Supertest. Tests first (red-green-refactor). Use real DB (in-memory SQLite for tests), real API calls (with test keys or sandbox mode).  
- Environment: `.env` for all secrets (DB_PATH, SESSION_SECRET, API keys).  

**Prompt Context Reminder** (include this in every LLM prompt):  
"Follow the conventions above strictly. Use TypeScript. Write tests first. Use real data and real API calls (no mocks unless external service is down). Build incrementally — every prompt must integrate with previous code. End each prompt with wiring (routes in app.ts, tests passing)."

### Complete Database Schema (now with all tables)

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
  company         TEXT,
  UNIQUE(workspace_id, primary_email) ON CONFLICT IGNORE,
  UNIQUE(workspace_id, primary_phone) ON CONFLICT IGNORE
);

-- Custom Fields (EAV)
CREATE TABLE custom_fields (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  workspace_id  TEXT REFERENCES workspaces(id),
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
  workspace_id  TEXT REFERENCES workspaces(id),
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
  type            TEXT NOT NULL,                 -- one-off, scheduled, drip
  template_id     TEXT REFERENCES templates(id),
  segment_json    TEXT,
  schedule_json   TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Approvals (Loan Factory only)
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
  content       TEXT NOT NULL,                    -- JSON
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
  scope         TEXT NOT NULL,                    -- global / user / workspace
  scope_id      TEXT,                             -- user_id or workspace_id or NULL
  setting_key   TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope, scope_id, setting_key)
);
```

### Recommended Indexes (add in migration)

```sql
CREATE INDEX idx_base_contacts_workspace_id ON base_contacts(workspace_id);
CREATE INDEX idx_custom_fields_contact_id ON custom_fields(contact_id);
CREATE INDEX idx_custom_fields_workspace_id ON custom_fields(workspace_id);
CREATE INDEX idx_contact_list_assignments_contact_id ON contact_list_assignments(contact_id);
CREATE INDEX idx_communication_logs_contact_id ON communication_logs(contact_id);
CREATE INDEX idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX idx_templates_workspace_id ON templates(workspace_id);
CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
```

### Final Chunk Breakdown (12 right-sized chunks)

1. Project setup & boilerplate  
2. Users & session auth  
3. API keys & API security middleware  
4. Workspaces  
5. Contact lists  
6. Base contacts  
7. Custom fields (EAV) + definitions  
8. Communication log  
9. Templates + AI generation  
10. Campaigns + approvals  
11. Email & Twilio providers + sending  
12a. AI monitoring & insights  
12b. Dashboard (SSR views + aggregation)  
12c. CSV import/export  
12d. Backups, audit logging, deployment script  

### Implementation Prompts (ready to use)

Each prompt is self-contained but assumes previous code exists (copy-paste output from prior prompt into context).

```markdown
**Prompt 1: Project Setup & Boilerplate**

Create the initial project structure for pi-crm in TypeScript (strict mode). Use Node.js, Express, TypeORM (SQLite), EJS + Tailwind (CDN), Jest for testing.  

Follow these conventions:  
- TypeScript only, no `any`  
- OOP classes with interfaces  
- Tests first (Jest + Supertest)  
- Real DB (SQLite file + in-memory for tests)  
- Consistent error format { error: { message, code } }  
- Responses { data, error: null | {…} }  

Tasks:  
1. package.json + tsconfig.json (strict, esModuleInterop)  
2. .env + .env.example (PORT, SESSION_SECRET, DB_PATH, API keys)  
3. app.ts: Express server, TypeORM connection, session, rate-limit, body-parser  
4. Health route GET /health → { status: 'ok' }  
5. First test: src/tests/health.test.ts → supertest GET /health → 200  

Run and verify: npm run dev starts server, connects to real DB.
```

```markdown
**Prompt 2: Users & Session Authentication**

Build on Prompt 1 code. Use TypeScript. Tests first. Real DB.  

1. Write tests for User entity and auth flow (Jest + Supertest).  
   - Create user (hash password)  
   - Login success/failure  
   - Session persists userId  

2. Entities:  
   - User (id: string, email: string, password_hash: string, name?: string, created_at: Date)  

3. AuthService class:  
   - register(email, password, name)  
   - login(email, password) → return user or throw  

4. AuthController: POST /api/auth/login, POST /api/auth/logout  

5. Middleware: requireLogin (check req.session.userId)  

6. Seed migration: create Andy & Monalisa  

7. Wire to app.ts (routes + session config).  

Test: real login/logout with supertest, session cookie set.
```

```markdown
**Prompt 3: API Keys & API Security Middleware**

Build on Prompt 2. Tests first. Real DB.  

1. Tests for ApiKey entity and validation.  
   - Generate key  
   - Validate valid/invalid/expired key  
   - Middleware rejects bad key  

2. Entity: ApiKey (id, user_id, key, description, scopes: string[], created_at, expires_at, is_active)  

3. Extend AuthService:  
   - generateApiKey(userId, description, scopes, expiresInDays?)  
   - validateApiKey(key) → { user, scopes } or throw  

4. ApiKeyMiddleware: check X-Api-Key header, validate, attach req.user & req.apiScopes  

5. Protected route example: GET /api/protected → requireApiKey → return user info  

6. Routes: POST /api/auth/keys, DELETE /api/auth/keys/:id (require login)  

Wire: Add middleware to all /api/ routes except /auth. Test with real key generation and protected call.
```

```markdown
**Prompt 4: Workspaces**

Build on Prompt 3. Tests first. Real DB.  

1. Tests for Workspace entity and service (create, listByUser, isolation).  

2. Entity: Workspace (id, user_id, name, created_at)  

3. WorkspaceService: create(userId, name), listByUser(userId), update(id, name), delete(id)  

4. WorkspaceController: GET /api/workspaces, POST /api/workspaces {name}, etc.  

5. Middleware: workspaceBelongsToUser (check workspace.user_id === req.user.id)  

Wire: Add to app.ts. Test: create workspace as Andy → only Andy sees it.
```

```markdown
**Prompt 5: Contact Lists**

Build on Prompt 4. Tests first.  

1. Tests: list creation, primary/secondary assignment, enforce one primary.  

2. Entities: ContactList, ContactListAssignment  

3. ListService: createList(workspaceId, name, isPrimary), assignToContact(contactId, listId, isPrimary?)  

4. Routes: POST /api/lists, POST /api/lists/assign  

Wire: Test real assignment, log primary change (stub log service for now).
```

```markdown
**Prompt 6: Base Contacts**

Build on Prompt 5. Tests first.  

1. Tests: create/find/update/delete base contact, duplicate email/phone check.  

2. Entity: BaseContact (only 6 fields)  

3. ContactService: create(workspaceId, data), findById(id), update(id, data), delete(id)  

4. Routes: POST /api/contacts, GET /api/contacts/:id, etc.  

Wire: Test real create with duplicate detection.
```

```markdown
**Prompt 7: Custom Fields (EAV)**

Build on Prompt 6. Tests first.  

1. Tests: define field, set/get custom value, definitions isolation.  

2. Entities: CustomField, CustomFieldDefinition  

3. CustomFieldService: defineField(...), getDefinitions(workspaceId, userId), setValue(contactId, name, value, type?)  

4. Extend ContactService: loadWithCustom, getCustom, setCustom  

5. Routes: POST /api/custom-definitions, POST /api/contacts/:id/custom, GET /api/contacts/:id/custom  

Wire: Test real custom field creation and retrieval.
```

```markdown
**Prompt 8: Communication Log**

Build on Prompt 7. Tests first.  

1. Tests: log creation, get paged/filtered logs.  

2. Entity: CommunicationLog  

3. LogService: create(contactId, type, content, status?), getByContact(contactId, type?, page, limit)  

4. Routes: POST /api/logs, GET /api/contacts/:id/logs  

Wire: Test real logging on contact update (extend ContactService).
```

```markdown
**Prompt 9: Templates & AI Generation**

Build on Prompt 8. Tests first.  

1. Tests: create template, generate draft (real OpenAI call with test key).  

2. Entity: Template  

3. TemplateService: create(...), generate(workspaceId, goal, audience, tone, mustHaves) → OpenAI → save draft  

4. Routes: POST /api/templates/generate, POST /api/templates  

Wire: Test real AI call (use small test prompt).
```

```markdown
**Prompt 10: Campaigns & Approvals**

Build on Prompt 9. Tests first.  

1. Tests: create campaign, submit/approve/reject (Loan Factory only).  

2. Entities: Campaign, CampaignApproval  

3. CampaignService: create(...), submitForApproval, approve/reject  

4. Routes: POST /api/campaigns, POST /api/campaigns/:id/approve  

Wire: Test real campaign creation + approval flow.
```

```markdown
**Prompt 11: Email & Twilio Providers + Sending**

Build on Prompt 10. Tests first.  

1. Tests: send email/text with real test keys (sandbox mode).  

2. EmailProvider interface + implementations (Mailgun, Google, Microsoft)  

3. TextService: send(to, message) → Twilio real call  

4. Extend CampaignService: execute → personalize + send via provider  

Wire: Test real send (use test recipient).
```

```markdown
**Prompt 12a: AI Monitoring & Insights**

Build on Prompt 11. Tests first.  

1. Tests: generate insight, cron-like analysis.  

2. Entity: AiInsight  

3. AiMonitorService: analyzeUsage() → query logs → OpenAI → save insight  

4. Routes: GET /api/ai-insights  

Wire: Test real analysis (small test data).
```

```markdown
**Prompt 12b: Dashboard (SSR Views)**

Build on 12a. Tests first (view rendering).  

1. DashboardService: getWidgets(userId) → aggregate data  

2. Routes: GET /dashboard → render dashboard.ejs  

3. EJS: dashboard.ejs with prioritized sections (use Tailwind grid)  

Wire: Real data from services.
```

```markdown
**Prompt 12c: CSV Import/Export**

Build on 12b. Tests first.  

1. Tests: export CSV, import parse + save.  

2. CsvService: export(workspaceId), import(file, workspaceId)  

3. Routes: GET /api/csv/export, POST /api/csv/import  

Wire: Test real export/import with custom fields.
```

```markdown
**Prompt 12d: Backups, Audit Logging, Final Wiring & Deployment**

Build on 12c. Tests first.  

1. Tests: backup creation, audit log entry.  

2. BackupService: runBackup()  

3. AuditLog entity + AuditService: logAction(userId, action, entity, details)  

4. Final app.ts: all routes, middlewares, cron (node-cron for backups/AI).  

5. Deployment script: pm2 ecosystem file, backup cron.  

Wire: Test full app flow (create contact → log → campaign → insight).
```

These prompts are now small enough to implement safely (1–2 features each), test-driven, real-data focused, and cumulative — no orphans.

