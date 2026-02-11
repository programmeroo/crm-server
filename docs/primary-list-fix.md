# Primary List Implementation Fix

## The Problem

The original implementation had a fundamental conceptual mismatch about what "primary list" means:

### What Was Wrong
- **`ContactList.is_primary`** was meant to mark whether a list *type* is "primary" at the workspace level (e.g., "Leads" is a primary list type, "Prospects" is not)
- When assigning a contact to a list marked `is_primary=1`, the code would remove the contact from OTHER primary-type lists
- This prevented a contact from being in multiple lists if they were all marked as "primary type"
- **Result**: A contact couldn't belong to multiple "primary type" lists, which violated the requirement

### What Should Happen
- A contact can belong to **multiple lists** (e.g., "Leads", "Active", "VIP")
- **One** of those assignments should be marked as "primary" for that contact (for display/filtering purposes)
- The "primary" flag belongs on the **assignment relationship**, not on the list itself
- Different contacts in the same workspace can have different primary lists

---

## The Solution

### 1. **Database Schema Changes**

**Removed** `is_primary` from `contact_lists` table:
```sql
-- BEFORE
CREATE TABLE contact_lists (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_primary    INTEGER DEFAULT 0,  -- ❌ REMOVED
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);
```

**Added** `is_primary` to `contact_list_assignments` table:
```sql
-- BEFORE
CREATE TABLE contact_list_assignments (
  contact_id    TEXT NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  list_id       TEXT NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  assigned_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id, list_id)
);

-- AFTER
CREATE TABLE contact_list_assignments (
  contact_id    INTEGER NOT NULL REFERENCES base_contacts(id) ON DELETE CASCADE,
  list_id       INTEGER NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  is_primary    INTEGER DEFAULT 0,  -- ✅ ADDED
  assigned_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id, list_id)
);
```

### 2. **Entity Changes**

**ContactList.entity.ts**:
- Removed `is_primary` field (lists are just lists now)

**ContactListAssignment.entity.ts**:
- Added `is_primary: number` field to track which assignment is primary

### 3. **Service Logic Changes (ListService.ts)**

**`createList()` method**:
- Removed `isPrimary` parameter - lists are created without any "primary" designation

**`assignToContact()` method**:
- Added `makePrimary` parameter (optional, defaults to false)
- **Auto-primary logic**: First assignment of a contact to a list in a workspace is automatically marked primary
- When assigning to additional lists, they're marked as secondary
- If `makePrimary=true`, it unmarks any other primary assignment in that workspace and marks this one as primary

**New methods**:
- **`getPrimaryListForContact(contactId, workspaceId)`**: Returns the primary list for a contact in a specific workspace
- **`setAssignmentAsPrimary(contactId, listId, workspaceId)`**: Explicitly set an assignment as primary (unmarks others)
- **`getListsForContact()` updated**: Now returns lists with `is_primary` info merged from assignments

### 4. **Controller Changes**

**ListController.ts**:
- Removed `isPrimary` from list creation validation schema
- Updated `create()` method to not pass isPrimary parameter
- Added new `POST /api/lists/assign/set-primary` endpoint with `setPrimarySchema`
- Added `setPrimary()` method to handle primary assignment changes

**ContactUIController.ts**:
- Updated `getContactList()` to properly find primary assignment from the merged list data

### 5. **API Changes**

**New Endpoint**: `POST /api/lists/assign/set-primary`
```json
{
  "contactId": 123,
  "listId": 456,
  "workspaceId": 789
}
```
Changes which list is primary for a contact in a workspace.

---

## How It Works Now

### Example Workflow

1. **Create lists** (no primary concept at list level):
   ```
   POST /api/lists
   { "workspaceId": 1, "name": "Leads" }
   { "workspaceId": 1, "name": "Active" }
   { "workspaceId": 1, "name": "VIP" }
   ```

2. **Assign contact to first list** (automatically becomes primary):
   ```
   POST /api/lists/assign
   { "contactId": 10, "listId": 1 }
   → Assignment created with is_primary = 1
   ```

3. **Assign same contact to second list** (secondary):
   ```
   POST /api/lists/assign
   { "contactId": 10, "listId": 2 }
   → Assignment created with is_primary = 0
   ```

4. **Change primary list**:
   ```
   POST /api/lists/assign/set-primary
   { "contactId": 10, "listId": 2, "workspaceId": 1 }
   → Old primary (Leads) set to is_primary = 0
   → New primary (Active) set to is_primary = 1
   ```

5. **Get contact with primary list** (in UI):
   ```
   ContactUIController finds lists for contact
   Filters to find: lists.find(l => l.is_primary === 1)
   Displays "Active" as the primary list for this contact
   ```

---

## Display Impact

In the **Contacts list view**, the "Primary List" column now correctly shows:
- The **one list** that is marked as primary for that contact
- If a contact has no lists, it shows blank
- If a contact is in multiple lists, exactly one will be shown as primary

---

## Testing Considerations

When updating tests, remember:
- Remove `isPrimary` from `createList()` calls
- Update `assignToContact()` calls (no longer passes isPrimary to lists)
- Check assignment objects for `is_primary` field instead of checking the list
- When testing "primary" logic, verify via the assignment's `is_primary` field
