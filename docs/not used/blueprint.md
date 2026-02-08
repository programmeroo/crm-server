### Detailed, Step-by-Step Blueprint for Building Pi-CRM

This blueprint provides a high-level architectural plan for implementing the pi-crm app based on the final specification. It assumes a Node.js backend with OOP design, TypeORM for ORM, Express for API and SSR, EJS for views, Tailwind for styling, and SQLite as the database. The focus is on incremental building, with strong emphasis on testing at each step using Jest for unit/integration tests and real data (no mocks). Real API calls (e.g., to OpenAI for AI, Twilio for texting, Mailgun/Google/Microsoft for email) will be used where relevant, with environment variables for keys and stubbed only if external services are unavailable during testing (but prefer real calls with test accounts).

**Overall Architecture Overview**:
- **Backend**: OOP classes for models (entities with TypeORM), repositories (data access), services (business logic), controllers (API handling), middlewares (auth, validation).
- **Frontend**: SSR with EJS views; minimal client-side JS for interactivity (e.g., fetch for async forms).
- **Database**: SQLite with migrations; EAV for custom fields.
- **Security**: Session-based auth for UI, API keys for external/headless access.
- **AI Integration**: OpenAI API for template generation and monitoring; real calls during development (use test prompts).
- **Testing**: TDD approach – write tests first for each feature, use real database (in-memory SQLite for tests), real API calls (with test keys).
- **Deployment**: Raspberry Pi; use PM2 for process management, cron for backups.
- **Tools/Deps**: express, typeorm, reflect-metadata, sqlite3, bcrypt, express-session, csurf, express-rate-limit, uuid, joi, winston, sharp, openai, twilio, mailgun-js, googleapis, @microsoft/microsoft-graph-client, ejs, jest, supertest, nodemon, pm2.

**Step-by-Step Development Plan**:
1. **Setup & Boilerplate**: Initialize project, database connection, basic server, env config.
2. **Authentication & Users**: Implement user login, sessions, API keys.
3. **Workspaces**: Add workspaces with isolation.
4. **Contact Lists**: Implement lists and assignments.
5. **Base Contacts**: Add minimal base contact CRUD.
6. **Custom Fields (EAV)**: Implement definitions and values.
7. **Communication Log**: Add logging system.
8. **Templates & AI Generation**: Implement templates with AI interface.
9. **Campaigns & Approvals**: Add campaigns with Loan Factory approval.
10. **Email & Twilio Providers**: Integrate providers with real calls.
11. **AI Monitoring**: Add monitoring and insights.
12. **Dashboard & UI Polish**: Build SSR views and dashboard.
13. **CSV Import/Export**: Add CSV handling.
14. **Transactions (as Custom Field)**: Ensure custom fields support transaction use case.
15. **Security & Backups**: Finalize audit logging, API keys, backups.
16. **Testing & Deployment**: Full integration testing, Pi deployment script.

**Tools & Best Practices**:
- Version control: Git (commit after each chunk).
- Testing: Jest + Supertest for APIs; test real DB interactions with in-memory SQLite.
- Incremental: Each chunk ends with integration into previous (e.g., wire new service to controller).
- Real data: Use test data in DB seeds; real API calls with sandbox keys (e.g., Twilio test number, OpenAI test prompts).

### Initial Chunk Breakdown

I broke the blueprint into 16 chunks, each representing 1–3 days of work (assuming full-time). Each chunk builds on the previous, starts with tests, and ends with integration/wiring.

**Iteration 1 Review**: Chunks were too high-level (e.g., "Contacts" covers too much). Broke into smaller: separate base contacts from custom fields.  

**Iteration 2 Review**: Still some big jumps (e.g., campaigns include approvals and sending). Split campaigns into core + approvals + providers.  

**Iteration 3 Review**: Now right-sized: Each chunk is 1–2 features, testable independently, but integrates (e.g., add route/service, test API, wire to UI if applicable). No orphans – each ends with "wire to existing app.ts or controller". Testing first, real data/APIs.  

Final Chunks (12 total, right-sized for weeks of work):
1. Setup & Boilerplate  
2. Users & Auth (sessions)  
3. API Keys & Security Middleware  
4. Workspaces  
5. Contact Lists  
6. Base Contacts  
7. Custom Fields EAV  
8. Communication Log  
9. Templates & AI Generation  
10. Campaigns Core & Approvals  
11. Email/Twilio Providers & Sending  
12. AI Monitoring, Dashboard, CSV, Backups, Deployment

