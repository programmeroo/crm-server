# Pi-CRM Project Memory (v1.6 - Prompts Complete)

## Current State
- **V1.5 MIGRATION COMPLETE** - Integer PKs, contacts belong to Users → Workspaces
- **Prompts 1-10 COMPLETE** (Setup, Users/Auth, API Keys, Audit, Workspaces, Contacts, Contact Lists, Custom Fields, Prompts, Campaigns)
- **UI Fully Built**: Dashboard, Contacts, Workspaces, Templates, Settings, Campaigns - all match design spec
- **Git**: main branch
- **Database**: `data/pi-crm.db` with INTEGER PKs (no prompts table - file-based system)

## Prompt 9 (Prompts - Markdown File-Based System) - COMPLETED

**Architecture**: Markdown files stored in filesystem, not database

**Files Created**:
- `src/services/PromptFileService.ts` - File I/O with YAML frontmatter parsing using gray-matter
- `src/controllers/SettingsUIController.ts` - Manages `/settings` route and prompt management
- `views/settings/index.ejs` - Main settings page with Prompts tab
- `views/settings/prompt-detail.ejs` - Prompt editing view

**File Structure**:
```
data/prompts/
├── {workspaceId}/
│   ├── All Lists/          # Workspace-wide prompts
│   │   └── {slug}.md
│   └── {listId}/           # List-specific prompts
│       └── {slug}.md
```

**Markdown Format** (YAML frontmatter + content):
```markdown
---
workspace_id: 1
list_id: 5
name: "CA Dreamers Program 1"
description: "Initial outreach prompt"
created_at: "2026-02-10T12:00:00Z"
updated_at: "2026-02-10T15:30:00Z"
---

Your prompt content here...
```

**Key Features**:
- ✅ Workspace-scoped access control
- ✅ Optional list association ("All Lists" = workspace-wide)
- ✅ Workspace-aware list dropdown (fetches from ListService, not inferred)
- ✅ CRUD via API (`/api/prompts`) and UI (`/settings`)
- ✅ Human-readable files, manually editable in VS Code
- ✅ Git-friendly, version-controllable

**UI Integration**:
- Settings link in sidebar (gear icon)
- Settings → Prompts tab
- Filters: Workspace dropdown → List dropdown (updates based on selected workspace)
- Create modal with workspace/list selection
- Detail view with metadata sidebar (workspace, list, created/updated timestamps)

**Terminology**: "All Lists" for workspace-wide prompts (not "Global")

## Prompt 10 (Campaigns) - COMPLETED

**Architecture**: Multi-step campaign creation with Loan Factory-specific approval workflow

**Entities Created**:
- `src/entities/Campaign.entity.ts` - INTEGER PK, workspace-scoped, JSON columns for segment/schedule
- `src/entities/CampaignApproval.entity.ts` - INTEGER PK, tracks approval status and reviewer

**Services**:
- `src/services/CampaignService.ts` - Full CRUD + approval logic
  * `create()` - Auto-sets status to 'pending' (+ creates approval record) ONLY for "Loan Factory" workspace
  * All other workspaces (Andy's other workspaces, Monalisa's workspaces) skip approval → status='draft'
  * `approveCampaign()`, `rejectCampaign()` - Approval workflow
  * `getPendingApprovalsForUser()` - Gets all pending campaigns across user's workspaces

**Controllers**:
- `src/controllers/CampaignController.ts` - 8 REST API endpoints:
  * GET /api/campaigns/pending-approvals (user's pending campaigns)
  * GET /api/campaigns/by-workspace/:workspaceId
  * POST, GET, PUT, DELETE /api/campaigns/:id
  * POST /api/campaigns/:id/approve, /reject
- `src/controllers/CampaignUIController.ts` - 7 UI routes:
  * GET /campaigns (list view with filters)
  * GET /campaigns/new (creation form - multi-step)
  * GET /campaigns/:id (detail/edit view with approval section)
  * POST, PUT, DELETE for create/edit/delete
  * POST /approve, /reject for approval actions

**Views**:
- `views/campaigns/index.ejs` - Campaign list with card grid, filters (status, type, workspace), search, modals for create/approve/reject
- `views/campaigns/create.ejs` - Multi-step form: workspace → campaign details → template → recipients → schedule
  * Loan Factory warning banner if workspace='Loan Factory'
  * Recipient options: whole list / filtered / manual (advanced options deferred to detail page)
  * Schedule type: immediate / scheduled / drip
- `views/campaigns/detail.ejs` - Campaign detail view with sections:
  * Campaign basics (type, workspace, created/updated dates)
  * Template display with edit modal
  * Recipients section with edit modal (placeholder for future enhancement)
  * Schedule section with edit modal (placeholder for future enhancement)
  * **Approval section** (Loan Factory only):
    - Status badge (pending/approved/rejected)
    - Reviewer name and reviewed_at timestamp
    - Approval notes
    - Approve/Reject buttons (if status='pending')
  * Quick actions: Send Test, Preview, Send (conditional on status)
  * Campaign ID card

**Database Schema**:
```sql
CREATE TABLE campaigns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id    INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('one-off','scheduled','drip')),
  template_id     INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  segment_json    TEXT,
  schedule_json   TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaign_approvals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id     INTEGER NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewer_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at     TEXT
);
```

**Key Features**:
- ✅ Multi-step campaign creation form
- ✅ Loan Factory-specific approval workflow (ONLY for "Loan Factory" workspace)
- ✅ All other workspaces skip approval entirely (go directly to draft)
- ✅ Dashboard integration: real pending approvals from CampaignService
- ✅ Full CRUD via API and UI
- ✅ Recipient segmentation (whole list / filtered / manual)
- ✅ Schedule types (one-off, scheduled, drip)
- ✅ Workspace access control (users can only create/view/approve campaigns in their workspaces)
- ✅ Template integration (optional template selection during creation)

**Integration Points**:
- `src/controllers/DashboardController.ts` - Updated to fetch real pending approvals from CampaignService
- `src/app.ts` - CampaignService instantiated, CampaignController + CampaignUIController mounted at /api/campaigns and /campaigns
- Database tables auto-created via TypeORM (synchronize: true)

**Loan Factory Business Rule**:
- Campaigns in "Loan Factory" workspace automatically get status='pending' + approval record
- All other workspaces skip approval and go directly to status='draft'
- This is a workspace name check (workspace.name === 'Loan Factory'), not user-specific or workspace-type-specific

**Tests**:
- Deferred per user request ("Focus on app functionality first, fix tests later")
- Existing test files excluded from build (tsconfig.json excludes *.test.ts)
- Future: campaign.test.ts with CRUD, approval workflow, workspace isolation, Loan Factory logic tests

## Build & Testing Configuration
- **tsconfig.json**: Excludes test files from build (`src/**/*.test.ts`) to allow app to build despite pending test fixes
- **npm run build**: Builds TypeScript successfully (tests excluded)
- **npm run dev**: Starts development server with hot reload
- **App Status**: Running on http://localhost:3000, health check passing

## Deferred Work
- Test suite fixes (UUID→Integer conversion) - defer per user directive "focus on app functionality first"
- Advanced recipient filtering in campaign detail page (placeholder shown)
- Advanced schedule management for drip campaigns (placeholder shown)
- Test file: campaign.test.ts (deferred)

## Next Steps
- Prompt 11: Email sending/delivery integration (connect to email providers)
- Prompt 12: Campaign execution and tracking (send emails, track opens/clicks)
- Prompt 13+: Additional features (AI insights, reporting, etc.)
- Fix deferred tests after all prompts complete
