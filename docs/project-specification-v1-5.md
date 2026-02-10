Here is the **comprehensive, updated project specification (v1.5)** for **pi-crm**.

This version includes the pivot in contact management:
- **Integer PKs** (from v1.4)
- **Contacts belong to Users first**, and Workspaces second.
- **Deleting a Workspace does NOT delete the contacts** (they remain unassigned but tied to the User).
- **Isolation remains strict** between Users (Andy vs Monalisa).

# Pi-CRM – Comprehensive Final Project Specification

**Version**: 1.5 – Revised Contact Management  
**Date**: February 2026  
**Project name**: pi-server  
**App name**: pi-crm  
**Purpose**: A lightweight, home-use CRM for Andy and Monalisa to manage segmented contacts, communications, templates, campaigns, and AI-assisted workflows across multiple business lines.

## 1. Technology Stack & Tools (Unchanged)
... [Stack details: TS, Express, TypeORM, SQLite, EJS, Tailwind] ...

## 2. Database Schema (Revised)

All primary keys are `INTEGER PRIMARY KEY AUTOINCREMENT`.  
Foreign keys use `INTEGER`.

```sql
-- Users (Andy & Monalisa)
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Workspaces (e.g., Loan Factory, MaiStory)
CREATE TABLE workspaces (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

-- Base Contacts (Revised: Belongs to User, optionally to Workspace)
CREATE TABLE base_contacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    INTEGER REFERENCES workspaces(id) ON DELETE SET NULL, -- No Cascade!
  created_on      TEXT NOT NULL DEFAULT (datetime('now')),
  first_name      TEXT,
  last_name       TEXT,
  primary_email   TEXT,
  primary_phone   TEXT,
  company         TEXT,
  UNIQUE(user_id, primary_email),
  UNIQUE(user_id, primary_phone)
);

-- Contact Lists (Stages/Tags - still scoped to Workspace)
CREATE TABLE contact_lists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_primary    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, name)
);

-- ... [Other tables per v1.4: custom_fields, templates, campaigns, etc.] ...
```

### Key Change Rationale:
1. **Contact Persistence**: By adding `user_id` to `base_contacts` and making `workspace_id` nullable with `ON DELETE SET NULL`, contacts survive the deletion of a business line/workspace.
2. **Global Address Book**: A user can see all their contacts across all workspaces or filter by current workspace.
3. **Uniqueness**: Contacts are unique *per user*. You cannot have two "john@doe.com" records for Andy, but Monalisa can have her own "john@doe.com".

## 3. UI/UX Design Decisions

### Dashboard Layout
The dashboard follows the wireframe specification with these sections:
- **Pending Approvals** (red left border) - Campaign approvals requiring action
- **Activity Needing Attention** (yellow left border) - Bounced emails, stalled prospects, etc.
- **Todos / Action Items** - Grid of actionable tasks
- **Recent / Hot Leads** - Contact cards showing high-priority leads
- **Active & Upcoming Campaigns** - Campaign status with progress bars
- **AI Insights** - Compact teaser section
- **Quick Stats** - Overall metrics at bottom

### AI Insights Design
**Decision**: AI Insights on the dashboard is intentionally kept **compact and minimal** to avoid distraction:
- White background with blue left border (matches other dashboard cards)
- Shows only the **top 2 insights** as a preview
- Simple light-blue accent cards instead of dramatic dark gradient
- "View All" link leads to dedicated `/ai-insights` page for full interaction
- **Rationale**: The dashboard should provide quick overview and actionable items. Deep AI interaction belongs on a dedicated page where users can focus without distraction.

### Contact List Features
Per wireframe specification, the contacts list includes:
- **Search** - Real-time filtering by name, email, phone, company
- **Filters** - Workspace dropdown, Primary List dropdown
- **Table Columns** - Name, Email, Phone, Company, Primary List, Last Contact, Actions
- **Action Icons** - Eye (view), Pencil (edit), Envelope (email)
- **Bulk Actions** - Toolbar appears when contacts are selected: Send Email, Export Selected, Delete
- **Export** - CSV export for all or selected contacts

## 4. Revised Implementation Plan (v1.5)

The implementation order remains similar, but Prompt 5 (Workspaces) and Prompt 6 (Base Contacts) are updated to reflect the new ownership model.

| # | Prompt | Status |
|---|--------|--------|
| 1 | Setup & Boilerplate | done |
| 2 | Users & Session Auth | done |
| 3 | API Keys & Security | done |
| 4 | Audit Logging | done |
| 5 | Workspaces | done |
| 6 | Base Contacts (v1.5) | needs update |
| 7 | Contact Lists | needs update |
| ... | ... | ... |

[Detailed prompts follow in the prompt-plan-v1-5.md file]
