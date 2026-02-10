Here is the **complete, prioritized features list** for **pi-crm**, based on the full specification we developed together. This is the definitive, comprehensive list of every feature in the app.

### 1. Core Structure & Isolation
- Multiple **Workspaces** (isolated containers for business lines/personal categories, e.g. Loan Factory, MaiStory, RateReady Realtors, Family & Friends, etc.)
- Complete **data isolation** between Andy and Monalisa (no cross-user visibility by default)
- Per-contact **sharing** (read-only view + "Save As" to create independent copy in recipient's Workspace)
- Revoke sharing at any time

### 2. Contact Management
- **Base contact fields** (fixed, minimal): id, workspace_id, created_on, first_name, last_name, primary_email, primary_phone, company
- **Fully dynamic custom fields** via EAV (no fixed/predefined details like birthday, marital status, kids, pets, spouse, notes, etc.)
  - User defines custom fields in settings (per user or per Workspace): name, label, type (text/date/number/url/phone/email/json), required, default value
  - Custom fields rendered dynamically on contact detail page
  - Examples: alternate_email, business_phone, transaction_notes, loan_file_link, referral_source, etc.
- Duplicate detection: primary_email OR primary_phone match within Workspace
- Merge contacts: union custom fields, prompt for conflict resolution, reassign lists, copy logs, delete source
- Contact list view: searchable table, filters (primary list, tags, custom fields), pagination, bulk actions (send text/email, add tag, export)
- Contact detail/edit page: base form + dynamic custom fields, primary/secondary lists, pinned notices, full communication log

### 3. Contact Lists (Hybrid Model)
- One **primary List** per contact (pipeline stage: Leads, Prospects, Applications, Closed, Lost, etc.)
- Multiple **secondary Lists** (tags/segments: Hot Leads, Referred by John, Q3 Campaign, etc.)
- Primary list changes auto-logged in communication log
- List management: create, assign, remove, enforce one primary

### 4. Communication Log & Notices
- Centralized log per contact: All Activity, Emails, Texts, Calls, AI, Stage Changes, Notes, System
- Auto-logging on key events: email/text send, stage change, custom field update (if transaction-related), AI action, merge, import
- Pinned notices at top of contact detail page (last email/campaign, shared status, bounces, pending AI drafts, delivery issues, upcoming custom dates)
- Tabbed/paged view, expandable entries, load more/infinite scroll

### 5. Templates
- Workspace-specific
- AI-first creation: guided wizard (goal, audience, tone, must-haves) → pre-filled prompt → OpenAI generation → rich editor
- Rich editor: subject, preheader, body (HTML), signature, image upload + text overlay tool
- Reuse: copy to another Workspace, share with Monalisa (read-only + Save As), Favorites Library (user-level collection)
- Templates list: search, filter, actions (edit/copy/share/delete)

### 6. Campaigns
- Types: one-off/immediate, single scheduled blast, multi-step drip sequence
- **Loan Factory only**: mandatory approval queue for custom campaigns (submit → pending → Andy reviews/approves/rejects/edits)
- Recipient selection:
  - Whole primary list
  - Filtered (last campaign >60 days, last contact >X days, tags, custom fields, activity)
  - Manual selection
  - Exclusions (already received, Do Not Contact, recently contacted)
  - Saved/dynamic segments
- Smart triggers:
  - New prospect/leads → enroll prompt (default onboarding per list)
  - Inactive prospects ~60 days → suggestion card with pre-filled re-engagement campaign
  - Holiday/seasonal → broad saved segments
- Sending: personalize via placeholders, send via workspace email provider, log per contact
- Stats: sent, delivered, opened, clicked, bounced, unsubscribed

### 7. Email & Twilio
- **Email providers** configured per Workspace (workspace_email_providers table):
  - Mailgun (RateReady, MaiStory, AI Consulting)
  - Google Workspace (Loan Factory – send & receive approvals)
  - Microsoft 365 (personal/Family & Friends, Monalisa’s Coldwell Banker)
- Twilio: basic outbound texting + log replies, single dedicated From number

### 8. AI Monitoring & Interaction
- **AI agent** interacts with app via AiService:
  - Generate templates/marketing messages
  - Create visuals (image gen + text overlay)
  - Execute workflows (e.g. send template for Loan Factory approval)
  - Monitor usage → generate insights (template performance, income/tool ideas)
- Insights stored in ai_insights table, displayed on dashboard
- Focus: template optimization + new tool/income brainstorming
- Delivery: dashboard section + weekly email summary
- Cron-based analysis (hourly/daily)

### 9. Dashboard
**Prioritized widgets** (top to bottom):
1. **Pending Approvals** (Loan Factory queue)
2. **Activity Needing Attention** (bounces, unread replies, stalled contacts, new shares)
3. **Todos / Action Items** (manual + auto-generated)
4. **Recent / Hot Leads** (new contacts, hot tags)
5. **Active & Upcoming Campaigns** (progress, next send, pause/edit)
6. **AI Insights** (template suggestions, income ideas)
7. **Calendar / Upcoming Events** (custom date fields)
8. **Quick Stats** (total contacts, active campaigns, messages sent)

### 10. CSV Import/Export
- **Export**: base fields + custom fields as columns
- **Import**: map base fields; custom fields added if definition exists (or prompt to create)
- UI buttons on contacts list page

### 11. Transactions / Loan File
- Handled as custom field (e.g. field_name = "transaction_notes" or "loan_file_link")
- Value = free text / URL
- Changes auto-logged in communication log
- Emails containing transaction-related content auto-flagged/logged

### 12. Security & Backups
**Security**  
- Session-based auth for UI
- API keys for external/headless access (scoped permissions)
- Audit logging on all mutations
- Rate limiting, CSRF, input sanitization

**Backups**  
- Daily SQLite .backup via cron
- Copy to external USB/NAS/cloud
- In-app “Backup Now” button
- Prune old backups (keep last 30 days)

### 13. Additional Notes
- Responsive design (Tailwind breakpoints)
- Minimal client-side JS (fetch for async)
- Error handling: friendly messages + logging
- Testing: real DB + real API calls (test keys)
- Deployment: PM2 on Raspberry Pi, HTTPS via self-signed or Let’s Encrypt

