
### Prompts for Code-Generation LLM

Each prompt is tagged as text in a code block. Use them sequentially with a tool like Claude – provide the previous code/output as context for building on it. Each includes TDD (tests first), real data, and integration step.

```markdown
**Prompt 1: Setup & Boilerplate**

Implement the initial setup for pi-crm in Node.js with OOP, following the spec.  

First, write tests for database connection and basic server startup (use Jest). Test real SQLite connection (create in-memory DB for tests, verify tables can be created).  

Then, code:  
- Create project with package.json (dependencies as spec).  
- app.ts: Express server, TypeORM connection to pi-crm.db (real file), env from dotenv.  
- Basic middlewares: body-parser, session, rate-limit.  
- Health route: GET /health.  

End by wiring: run `npm start` should start server on PORT=3000, connect to DB without error. Use real env vars for testing.
```

```markdown
**Prompt 2: Users & Auth (Sessions)**

Build on Prompt 1 code for pi-crm.  

First, tests: Unit test User entity, integration test login/logout (use supertest, real DB seed with test user). Test real bcrypt hash/compare.  

Code:  
- User entity (TypeORM) as spec.  
- AuthService class: register (hash password, save), login (compare hash, return user).  
- Controllers: AuthController with POST /login, GET /logout.  
- Middleware: requireLogin (check session.userId).  

Wire: Add to app.ts (routes, session middleware). Seed Andy & Monalisa in migration. Test with real requests (supertest.post('/login') with valid/invalid creds).
```

```markdown
**Prompt 3: API Keys & Security Middleware**

Build on Prompt 2.  

Tests: Test ApiKey entity, validateApiKey method (real DB insert, valid/invalid/expired key). Test middleware with supertest (header check).  

Code:  
- ApiKey entity as spec.  
- Extend AuthService: generateApiKey (userId, description, scopes, expires?), validateApiKey(key) → return user/scopes or throw.  
- Middleware: apiKeyMiddleware (check X-Api-Key header, validate, attach req.user/req.scopes).  

Wire: Add middleware to /api/ routes in app.ts. Test with real key generation and protected route (e.g., GET /api/protected → requireApiKey).  
```

```markdown
**Prompt 4: Workspaces**

Build on Prompt 3.  

Tests: Workspace entity, WorkspaceService CRUD (real DB, test isolation by user_id).  

Code:  
- Workspace entity as spec.  
- WorkspaceService class: create(userId, name), listByUser(userId), update(id, name), delete(id).  

Wire: WorkspaceController with routes (GET /api/workspaces, POST {name}, etc.) + requireLogin. Test with supertest, real user session.
```

```markdown
**Prompt 5: Contact Lists**

Build on Prompt 4.  

Tests: ContactList & Assignment entities, ListService assign/remove (real assignments, enforce one primary).  

Code:  
- Entities as spec.  
- ListService: createList(workspaceId, name, isPrimary), assignToContact(contactId, listId, isPrimary?) → enforce primary unique, log if change.  

Wire: ListController routes (POST /api/lists, POST /api/lists/assign). Test real list creation/assignment.
```

```markdown
**Prompt 6: Base Contacts**

Build on Prompt 5.  

Tests: BaseContact entity, ContactService CRUD (real insert, duplicate check on email/phone).  

Code:  
- BaseContact entity as spec.  
- ContactService: create(workspaceId, data), findById(id), update(id, data), delete(id). Duplicate check in create.  

Wire: ContactController routes (POST /api/contacts, GET /api/contacts/:id, etc.). Test with real data.
```

```markdown
**Prompt 7: Custom Fields EAV**

Build on Prompt 6.  

Tests: CustomField & Definition entities, CustomFieldService define/get/set (real definitions, UI render simulation).  

Code:  
- Entities as spec.  
- CustomFieldService: defineField(userId, workspaceId?, name, label, type, required), getDefinitions(scopeId), setValue(contactId, name, value, type?) → upsert.  

Wire: Extend ContactService (loadWithCustom), routes (POST /api/contacts/:id/custom, GET /api/custom-definitions). Test real custom add/set.
```

```markdown
**Prompt 8: Communication Log**

Build on Prompt 7.  

Tests: CommunicationLog entity, LogService create/get (real logs, paged).  

Code:  
- Entity as spec.  
- LogService: create(contactId, type, content, status?), getByContact(contactId, type?, page, limit).  

Wire: Routes (POST /api/logs, GET /api/contacts/:id/logs). Test real logging on contact update.
```

```markdown
**Prompt 9: Templates & AI Generation**

Build on Prompt 8.  

Tests: Template entity, TemplateService generate (real OpenAI call with test key/prompt).  

Code:  
- Entity as spec.  
- TemplateService: create, generate(workspaceId, goal, audience, tone, mustHaves) → build prompt, call OpenAI, save draft.  

Wire: Routes (POST /api/templates/generate). Test real AI call (use OPENAI_API_KEY env).
```

```markdown
**Prompt 10: Campaigns & Approvals**

Build on Prompt 9.  

Tests: Campaign & Approval entities, CampaignService execute (real email send with test provider).  

Code:  
- Entities as spec.  
- CampaignService: create, submitApproval, approve, execute → personalize, send via provider.  

Wire: Routes (POST /api/campaigns, POST /api/campaigns/:id/approve). Test real send (test email key).
```

```markdown
**Prompt 11: Email/Twilio Providers & Sending**

Build on Prompt 10.  

Tests: EmailProvider subclasses, send (real calls with test keys).  

Code:  
- EmailProvider abstract + subclasses (Mailgun, Google, Microsoft) – send(to, subject, html).  
- TextService: send(to, message) – Twilio SDK, real call.  

Wire: Integrate into CampaignService. Test real email/text send.
```

```markdown
**Prompt 12: AI Monitoring, Dashboard, CSV, Backups, Wiring & Deployment**

Build on Prompt 11.  

Tests: AiInsight entity, monitorUsage (real analysis), dashboard aggregation.  

Code:  
- AiMonitorService: monitorUsage → analyze logs, generate insights (OpenAI call), save.  
- DashboardService: getWidgets(userId) → aggregates.  
- CsvService: export(workspaceId), import(file).  
- BackupService: runBackup → .backup, prune.  

Wire: Routes for dashboard, CSV, backups. Cron for AI/backup. Final app.ts wiring (all routes/middlewares). PM2 deployment script. Test full flow.
```

Use these 12 prompts in order. Each builds on the previous (e.g., Prompt 4 uses AuthService from 2). Provide code output from previous to the LLM for context.

If this doesn't work or needs tweaks, let me know. What's your next step?