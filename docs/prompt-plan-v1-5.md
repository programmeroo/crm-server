# Pi-CRM Implementation Prompt Plan (v1.5)

This plan assumes **Integer PKs** and the **Revised Contact Ownership** (Contacts belong to Users, optionally assigned to Workspaces).

### Authoritative Reference Documents:
- `docs/project-specification-v1-5.md` (Schema & Logic)
- `docs/project-spec-wireframes-v1-4.md` (UI/UX)

---

### Prompt 1–5: Core Infra (Mostly Complete)
*Note: If starting fresh, ensure these use Integer PKs and the correct User/Workspace relationship.*

### Prompt 6 – Base Contacts (Revised v1.5)
```text
Build on existing code. 
Update/Create BaseContact entity and service to reflect v1.5 spec:
1. Entity: BaseContact
   - id: INTEGER PK AUTOINCREMENT
   - user_id: INTEGER FK (users.id), NOT NULL, ON DELETE CASCADE
   - workspace_id: INTEGER FK (workspaces.id), NULLABLE, ON DELETE SET NULL
   - first_name, last_name, primary_email, primary_phone, company, created_on (TEXT)
2. Uniqueness: UNIQUE(user_id, primary_email) and UNIQUE(user_id, primary_phone).
3. ContactService:
   - create(userId, data: { workspaceId?, firstName, ... })
   - listByUser(userId): All contacts for Andy.
   - listByWorkspace(workspaceId): Filtered contacts.
   - findById(id, userId): Scoped to user.
4. Controller: POST /api/contacts, GET /api/contacts (handle qp: workspaceId, search).
5. Tests: Verify that deleting a workspace leaves contacts in the DB with workspace_id = NULL.
```

### Prompt 7 – Contact Lists (Revised v1.5)
```text
Build on Prompt 6.
Lists are scoped to Workspaces. 
1. Entity: ContactList (id [int], workspace_id [int], name, is_primary)
2. Assignment: ContactListAssignment (contact_id [int], list_id [int])
3. ListService:
   - When assigning a contact to a list, verify the contact and the list belong to the same user.
   - If contact's workspace_id is NULL, updating their list assignment should optionally update their workspace_id to match the list's workspace.
4. Routes: POST /api/lists, POST /api/lists/assign.
```

### Prompt 8 – Custom Fields (Revised v1.5)
```text
Build on Prompt 7.
Custom fields are per-contact. 
Definitions can be User-Global (workspace_id IS NULL) or Workspace-Specific.
1. Entity: CustomField, CustomFieldDefinition (v1.5 schema).
2. Service: getValue(contactId, fieldName), setValue(contactId, fieldName, value).
3. Ensure Definitions retrieval respects the contact's current workspace_id + User-global definitions.
```

### Prompts 9–14: (Same as v1.4, but using Integer IDs and scoping to User/Workspace as defined)

### Prompt 15–17: UI Pivot (High Priority)
```text
Build on existing services.
1. Dashboard: Show 'Unassigned Contacts' (workspace_id IS NULL) as a special widget.
2. Contact List: Allow filtering by 'All Workspaces' or a specific one.
3. Detail View: Allow changing the Workspace assignment of a contact.
```

[Remaining prompts follow the v1.4 logic rewritten for Integer IDs]
