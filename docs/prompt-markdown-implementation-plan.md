# Plan: Replace Database-Backed Prompts with Markdown File System

## Context

The user explicitly rejected the database-backed Prompt system (Prompt.entity.ts, PromptService.ts, PromptController.ts) that was incorrectly created. They stated:

> "That's not what I asked for. Yes we need a prompt management system. I want the ability to edit an md file with default prompts for my templates, with the ability to change it in the UI."

**Requirements:**
- Prompts stored as markdown files (NOT database)
- UI to create/edit/delete prompts
- Hierarchy: workspace → list → prompt_name (e.g., "Loan Factory" > "Prospects" > "CA Dreamers Program 1")
- Files should be human-readable and editable outside the app

**Current Problem:**
- Database-backed Prompt entity/service/controller exist and need removal
- App is not running
- Need to implement correct markdown file-based approach

## Implementation Approach

### Architecture

**File Structure:**
```
data/prompts/
├── {workspaceId}/
│   ├── global/          # Prompts not tied to a specific list
│   │   └── {slug}.md
│   └── {listId}/        # List-specific prompts
│       └── {slug}.md
```

**Markdown Format with YAML Frontmatter:**
```markdown
---
workspace_id: 1
list_id: 5
name: "CA Dreamers Program 1"
description: "Initial outreach prompt"
created_at: "2026-02-10T12:00:00Z"
updated_at: "2026-02-10T15:30:00Z"
---

# Prompt Content

Your actual prompt content here...
```

**Filename Convention:** `{workspaceId}-{listId|global}-{slugified-name}.md`

### Critical Files to Modify/Create

1. **DELETE:**
   - `src/entities/Prompt.entity.ts` (database entity - incorrect approach)
   - `src/services/PromptService.ts` (database service - incorrect approach)

2. **CREATE:**
   - `src/services/PromptFileService.ts` - File I/O operations for prompts
   - `src/controllers/PromptUIController.ts` - UI routes for prompt management
   - `views/prompts/index.ejs` - List view with filters and create modal
   - `views/prompts/detail.ejs` - Edit view for individual prompts

3. **MODIFY:**
   - `src/controllers/PromptController.ts` - Convert from database to file-based
   - `src/app.ts` - Replace PromptService with PromptFileService, add UI controller
   - Package dependencies - Add `gray-matter` for YAML frontmatter parsing

4. **DATABASE CLEANUP:**
   - Drop `prompts` table from SQLite (after backup)

### Implementation Steps

#### Step 1: Install Dependencies
```bash
npm install gray-matter
npm install --save-dev @types/gray-matter
```

#### Step 2: Create PromptFileService

**File:** `src/services/PromptFileService.ts`

**Key Methods:**
- `constructor()` - Initialize base directory (`data/prompts`)
- `create(data)` - Create markdown file with frontmatter
- `findByFilename(filename)` - Read and parse markdown file
- `listByWorkspace(workspaceId)` - Scan workspace directory
- `listByWorkspaceAndList(workspaceId, listId)` - Filter by list
- `update(filename, data)` - Update file (may rename if name changes)
- `delete(filename)` - Remove file
- `generateFilename(workspaceId, listId, name)` - Create slugified filename
- `slugify(text)` - Convert to URL-safe slug
- `parseMarkdownFile(filepath)` - Use gray-matter to extract frontmatter + content
- `writeMarkdownFile(filepath, frontmatter, content)` - Write YAML + markdown
- `ensureDirectoryExists(dirPath)` - Create directories if missing

**Reuse Pattern:** Follow existing service patterns (constructor, error handling with AppError, logger usage)

#### Step 3: Create PromptUIController

**File:** `src/controllers/PromptUIController.ts`

**Routes:**
- `GET /` - List all prompts with workspace/list filters
- `GET /:filename` - Detail view for editing a prompt
- `POST /` - Create new prompt (from modal)
- `POST /:filename` - Update existing prompt
- `DELETE /:filename` - Delete prompt file

**Dependencies:** PromptFileService, WorkspaceService, ListService

**Reuse Pattern:** Follow TemplateUIController.ts structure (workspace verification, error handling, render with locals)

#### Step 4: Create Views

**File:** `views/prompts/index.ejs`

**Features:**
- Header with "New Prompt" button
- Filter dropdowns: Workspace, List (updates when workspace changes)
- Table columns: Name, Workspace, List, Last Updated, Actions
- Action icons: Eye (view), Pencil (edit), Delete
- Create modal with fields: Workspace, List (optional/global), Name, Description, Content (textarea)
- Client-side filtering JavaScript (follow contacts/index.ejs pattern)

**File:** `views/prompts/detail.ejs`

**Features:**
- Breadcrumb: Prompts / {prompt name}
- Two-column layout: Edit form (2/3) + Metadata sidebar (1/3)
- Form fields: Name, Description, Content (large textarea)
- Sidebar: Workspace badge, List badge, created/updated timestamps
- Save/Delete buttons
- JavaScript for POST/DELETE operations

**Reuse Pattern:** Follow templates UI structure (modals, Tailwind styling, fetch API calls)

#### Step 5: Modify PromptController (API)

**File:** `src/controllers/PromptController.ts`

**Changes:**
- Replace `PromptService` import with `PromptFileService`
- Change route params from `:id` to `:filename`
- Update `createSchema` to validate filename format
- Keep workspace access verification logic
- Update all method calls to use file-based operations

#### Step 6: Update app.ts

**File:** `src/app.ts`

**Changes:**
```typescript
// Line 16: Remove PromptService import, add PromptFileService and PromptUIController
import { PromptFileService } from './services/PromptFileService';
import { PromptUIController } from './controllers/PromptUIController';

// Line 94: Replace PromptService instantiation
const promptFileService = new PromptFileService(); // No DataSource needed

// After line 182 (after templates UI): Add PromptUIController
const promptUIController = new PromptUIController(promptFileService, workspaceService, listService);
app.use('/prompts', promptUIController.router);

// Line 201-202: Update PromptController to use PromptFileService
const promptController = new PromptController(promptFileService, workspaceService, listService);
app.use('/api/prompts', promptController.router);
```

#### Step 7: Delete Old Files

Using WSL bash commands:
```bash
rm src/entities/Prompt.entity.ts
rm src/services/PromptService.ts
```

#### Step 8: Database Cleanup

**SQL Command:**
```sql
DROP TABLE IF EXISTS prompts;
```

Execute via SQLite CLI or leave table (won't interfere since entity removed).

#### Step 9: Restart Application

```bash
npm run dev
```

### Verification Plan

**Test Sequence:**

1. **Create Global Prompt**
   - Navigate to `/prompts`
   - Click "New Prompt"
   - Select workspace, leave list as "Global"
   - Fill name, description, content
   - Submit and verify file created at `data/prompts/{workspaceId}/global/{slug}.md`

2. **Create List-Specific Prompt**
   - Create prompt with specific list selected
   - Verify file at `data/prompts/{workspaceId}/{listId}/{slug}.md`

3. **List and Filter**
   - Verify prompts appear in table
   - Filter by workspace - verify list dropdown updates
   - Filter by list - verify correct prompts shown

4. **Edit Prompt**
   - Click edit icon on a prompt
   - Modify name, description, content
   - Save and verify file updated
   - If name changed, verify file renamed

5. **Delete Prompt**
   - Delete a prompt via UI
   - Verify file removed from filesystem

6. **Manual File Edit**
   - Edit a .md file directly in VS Code
   - Refresh UI and verify changes reflected

7. **Workspace Access Control**
   - Try accessing prompt from different workspace
   - Verify 403 error returned

**Success Criteria:**
- All CRUD operations work via UI
- Files are human-readable markdown
- Filtering works correctly
- No database dependency
- Files can be edited manually outside app
- App runs without errors

### Edge Cases to Handle

- Special characters in prompt names (slugification)
- Very long names (truncate slug to 100 chars)
- Empty/null list_id (use "global" directory)
- Name collisions (append number suffix)
- Missing directories (auto-create)
- File doesn't exist (404 handling)
- Workspace/list verification (403 handling)

### Rollback Plan

If issues arise:
1. Keep database table (don't drop)
2. Git revert changes to app.ts
3. Delete new files (PromptFileService, PromptUIController, views)
4. Original database system remains functional

## Dependencies

**New packages:**
- `gray-matter` - YAML frontmatter parser (industry standard)
- `@types/gray-matter` - TypeScript definitions

## Notes

- This aligns with user's explicit request for markdown file-based system
- Files are git-friendly and version-controllable
- Can be edited with any text editor
- No database migration needed for new prompts
- Old `prompts` table can be dropped after backup
