Here is the **updated, concise, and corrected set of implementation prompts** for Claude (or any code-generation LLM).

These prompts have been revised to:

- Use **INTEGER PRIMARY KEY AUTOINCREMENT** consistently for all table IDs (as per your latest request)
- Explicitly reference the three documents you already have from me:
  - **project-specification-features** (the full features list)
  - **project-specification-v1-4** (the comprehensive spec with schema, endpoints, conventions, etc.)
  - **project-specification-wireframes** (the complete set of detailed UI wireframes)
- Avoid unnecessary token waste: no redundant schema pasting, no long-winded explanations in every prompt
- Keep each prompt focused, incremental, and cumulative (each one builds directly on the previous output)
- Emphasize **tests first**, **real data**, **real API calls** (sandbox/test keys), and **wiring everything together** at the end of each prompt
- Reduce verbosity so Claude doesn’t burn tokens on fluff

Copy-paste these one at a time into Claude. Provide the code/output from the previous prompt as context each time.

### Prompt 1 – Project Setup & Boilerplate

```text
You are building pi-crm, a Node.js TypeScript Express + TypeORM + SQLite CRM app for Raspberry Pi.

Follow these conventions strictly (from project-specification-v1-4):
- TypeScript strict mode, no any
- OOP with constructor injection
- Error: AppError class with code/status/message
- Response: { data, error: null | { code, message } }
- Logging: winston
- Validation: Joi
- Tests: Jest + Supertest, tests first, real DB (in-memory for tests), real API calls (test keys)
- Session store: connect-sqlite3
- Foreign keys: PRAGMA foreign_keys = ON
- Dependencies: express, typeorm, reflect-metadata, sqlite3, dotenv, bcrypt, express-session, connect-sqlite3, csurf, express-rate-limit, uuid, joi, winston, ejs, nodemon, jest, supertest, sharp, openai, twilio, mailgun-js, googleapis, @microsoft/microsoft-graph-client, node-cron

Tasks:
1. Create package.json, tsconfig.json (strict), .env.example
2. app.ts: Express server, TypeORM connection (pi-crm.db, PRAGMA foreign_keys=ON), session (connect-sqlite3), rate-limit, body-parser, csurf
3. Health route: GET /health → { status: 'ok' }
4. src/tests/health.test.ts → supertest GET /health → 200

Wire: npm run dev starts server, connects to real DB. Output the full app.ts and health test file.
```

### Prompt 2 – Users & Session Auth

```text
Build on Prompt 1 code.

Follow conventions from project-specification-v1-4.

Tasks:
1. Tests first: src/tests/auth.test.ts – User entity, register (bcrypt hash), login success/failure, session persistence
2. Entity: User (id INTEGER PK AUTOINCREMENT, email TEXT UNIQUE, password_hash TEXT, name TEXT, created_at TEXT)
3. AuthService class: register(email, password, name?), login(email, password) → User or throw AppError
4. AuthController: POST /api/auth/login, POST /api/auth/logout
5. Middleware: requireLogin (check session.userId)
6. Migration/seed: create Andy & Monalisa

Wire: Add routes to app.ts. Test real login/logout with supertest (session cookie).
```

### Prompt 3 – API Keys & Security Middleware

```text
Build on Prompt 2.

Tasks:
1. Tests first: ApiKey entity, generate/validate, middleware rejects bad key
2. Entity: ApiKey (id INTEGER PK AUTOINCREMENT, user_id INTEGER FK, key TEXT UNIQUE, description TEXT, scopes TEXT, created_at TEXT, expires_at TEXT, is_active INTEGER)
3. AuthService: generateApiKey(userId, description, scopes, expiresInDays?), validateApiKey(key) → { user, scopes } or throw
4. ApiKeyMiddleware: check X-Api-Key header, validate, attach req.user & req.apiScopes
5. Protected route example: GET /api/protected → requireApiKey → return user info
6. Routes: POST /api/auth/keys, DELETE /api/auth/keys/:id

Wire: Apply middleware to all /api/ routes except /auth. Test real key generation and protected call.
```

### Prompt 4 – Audit Logging

```text
Build on Prompt 3.

Tasks:
1. Tests first: AuditLog entity, logAction method
2. Entity: AuditLog (id INTEGER PK AUTOINCREMENT, user_id INTEGER, action TEXT, entity_type TEXT, entity_id INTEGER, details TEXT, ip_address TEXT, timestamp TEXT)
3. AuditService: logAction(userId, action, entityType?, entityId?, details?)
4. Wire: Call AuditService.logAction from AuthService (login, key gen)

Wire: Every future mutation service will call this. Test real log creation.
```

### Prompt 5 – Workspaces + System Settings

```text
Build on Prompt 4.

Tasks:
1. Tests first: Workspace entity, CRUD, isolation by user_id
2. Entities: Workspace (id INTEGER PK AUTOINCREMENT, user_id INTEGER, name TEXT, created_at TEXT)
   system_settings (id INTEGER PK AUTOINCREMENT, scope TEXT, scope_id INTEGER, setting_key TEXT, setting_value TEXT, created_at TEXT, updated_at TEXT)
3. WorkspaceService: create, listByUser, update, delete
4. WorkspaceController: GET /api/workspaces, POST /api/workspaces {name}, etc.
5. Middleware: workspaceBelongsToUser
6. Create initial system_settings row for default onboarding campaign per workspace type

Wire: Test real create/list isolation.
```

### Prompt 6 – Base Contacts

```text
Build on Prompt 5.

Tasks:
1. Tests first: BaseContact entity, CRUD, duplicate email/phone error
2. Entity: BaseContact (id INTEGER PK AUTOINCREMENT, workspace_id INTEGER, created_on TEXT, first_name TEXT, last_name TEXT, primary_email TEXT, primary_phone TEXT, company TEXT)
3. ContactService: create (check duplicates, throw AppError), findById, update, delete
4. Routes: POST /api/contacts, GET /api/contacts/:id, PUT /api/contacts/:id, DELETE /api/contacts/:id

Wire: Test real create with duplicate rejection.
```

### Prompt 7 – Contact Lists

```text
Build on Prompt 6.

Tasks:
1. Tests first: list creation, primary/secondary assignment, one primary enforcement
2. Entities: ContactList (id INTEGER PK AUTOINCREMENT, workspace_id INTEGER, name TEXT, is_primary INTEGER, created_at TEXT)
   ContactListAssignment (contact_id INTEGER, list_id INTEGER, assigned_at TEXT)
3. ListService: createList, assignToContact, removeAssignment
4. Routes: POST /api/lists, POST /api/lists/assign

Wire: Test real assignment. Log primary change using LogService (stub for now).
```

### Prompt 8 – Custom Fields (EAV)

```text
Build on Prompt 7.

Tasks:
1. Tests first: define field, set/get value, definitions isolation
2. Entities: CustomField (id INTEGER PK AUTOINCREMENT, contact_id INTEGER, field_name TEXT, field_value TEXT, field_type TEXT, created_at TEXT, updated_at TEXT)
   CustomFieldDefinition (id INTEGER PK AUTOINCREMENT, user_id INTEGER, workspace_id INTEGER, field_name TEXT, label TEXT, field_type TEXT, is_required INTEGER, default_value TEXT, created_at TEXT)
3. CustomFieldService: defineField, getDefinitions, setValue, getValue
4. Extend ContactService: loadWithCustom, getCustom, setCustom
5. Routes: POST /api/custom-definitions, POST /api/contacts/:id/custom, GET /api/contacts/:id/custom

Wire: Test real custom field add/set/get.
```

### Prompt 9 – Contact Merge Feature

```text
Build on Prompt 8.

Tasks:
1. Tests first: merge two contacts, union custom fields, list reassign, log merge
2. Extend ContactService: merge(sourceId, targetId, resolution: Record<string, 'source'|'target'|'custom'>, customValues?: Record<string, any>) → merge base + custom, reassign lists, copy logs, delete source
3. Route: POST /api/contacts/merge { sourceId, targetId, resolution, customValues? }

Wire: Test real merge.
```

### Prompt 10 – Communication Log

```text
Build on Prompt 9.

Tasks:
1. Tests first: log creation, get paged logs
2. Entity: CommunicationLog (id INTEGER PK AUTOINCREMENT, workspace_id INTEGER, contact_id INTEGER, type TEXT, content TEXT, timestamp TEXT, status TEXT)
3. LogService: create, getByContact
4. Routes: POST /api/logs, GET /api/contacts/:id/logs

Wire: Extend services to log on mutation.
```

### Prompt 11 – Templates & AI Generation

```text
Build on Prompt 10.

Tasks:
1. Tests first: create template, generate draft (real OpenAI call with test key)
2. Entity: Template (id INTEGER PK AUTOINCREMENT, workspace_id INTEGER, name TEXT, subject TEXT, body_html TEXT, preheader TEXT, signature TEXT, created_at TEXT, updated_at TEXT)
3. TemplateService: create, generate (OpenAI)
4. Routes: POST /api/templates, POST /api/templates/generate

Wire: Test real AI call.
```

### Prompt 12 – Campaigns & Approvals

```text
Build on Prompt 11.

Tasks:
1. Tests first: create campaign, submit/approve/reject
2. Entities: Campaign, CampaignApproval
3. CampaignService: create, submitForApproval, approve, reject
4. Routes: POST /api/campaigns, POST /api/campaigns/:id/approve

Wire: Test real approval flow.
```

### Prompt 13 – Email & Twilio Providers + Sending

```text
Build on Prompt 12.

Tasks:
1. Tests first: send email/text with real test keys
2. EmailProvider interface + implementations
3. TextService: send (Twilio)
4. Extend CampaignService: execute → send

Wire: Test real send.
```

### Prompt 14 – AI Monitoring & Insights

```text
Build on Prompt 13.

Tasks:
1. Tests first: generate insight, analyze usage
2. Entity: AiInsight
3. AiMonitorService: analyzeUsage → OpenAI → save
4. Routes: GET /api/ai-insights

Wire: Test real analysis.
```

### Prompt 15 – Dashboard Layout & Auth Views

```text
Build on Prompt 14.

Tasks:
1. Create layout.ejs (header, sidebar, session-aware)
2. login.ejs (form, error display)
3. GET /dashboard → requireLogin → render dashboard.ejs with placeholder widgets

Wire: Test session-aware navigation.
```

### Prompt 16 – Contact List & Detail Views

```text
Build on Prompt 15.

Tasks:
1. contacts-list.ejs: table, search/filter, pagination
2. contact-detail.ejs: base form + dynamic custom fields
3. Routes: GET /contacts, GET /contacts/:id, PUT /contacts/:id

Wire: Test real rendering/edit.
```

### Prompt 17 – Templates, Campaigns & Settings Views

```text
Build on Prompt 16.

Tasks:
1. templates.ejs + editor
2. campaigns.ejs + create form
3. settings-custom-fields.ejs + manage definitions

Wire: Test real view/form submission.
```

### Prompt 18 – CSV Import/Export

```text
Build on Prompt 17.

Tasks:
1. Tests first: export CSV, import parse + save
2. CsvService: export, import
3. Routes: GET /api/csv/export, POST /api/csv/import

Wire: Add UI buttons on contacts list page.
```

### Prompt 19 – Backups, Final Wiring & Deployment

```text
Build on Prompt 18.

Tasks:
1. Tests first: backup creation
2. BackupService: runBackup
3. Final app.ts: all routes/middlewares, cron
4. PM2 ecosystem file + Pi deployment script

Wire: Test full app flow.
```

This set is now tight, detailed, and incremental. Start with Prompt 1 in Claude — it should move much faster now that the schema is fixed, conventions are clear, and prompts are concise.

Let me know when you're ready for the next one or if you want any prompt expanded with example code snippets. Good luck!