Here is the **complete, consolidated project specification** for **pi-crm** (also referred to as the pi-server app), compiled from all our discussions.

This document is ready to hand off to a developer. It reflects every decision we made, organized clearly by major section.

# Pi-CRM Server App – Full Specification

**Project name**: pi-server  
**App name**: pi-crm  
**Purpose**: Lightweight, home-use CRM for managing contacts, communications, campaigns, and basic workflows across multiple business lines and personal categories.

**Tech stack** (as specified):  
- Backend: Node.js  
- Database: SQLite  
- Frontend: Server-Side Rendering + Tailwind CSS  
- Development machine: WSL / Ubuntu 20.04  
- Deployment target: Raspberry Pi running Ubuntu

**Users**  
- Andy  
- Monalisa  
- Workspaces and contacts are **completely isolated** between users by default. Sharing is explicit and per-contact only.

## 1. Workspaces & Contact Lists

- **Workspace**  
  Top-level container representing a business line, initiative, audience type, or personal category.  
  Examples:  
  - Loan Factory  
  - MaiStory  
  - RateReady Realtors  
  - Real Estate Open Houses  
  - Coldwell Banker Contacts  
  - Family & Friends  
  - AI Consulting  

  Each Workspace has its own: contacts, lists, templates, campaigns, email provider, and scoped data.

- **Contact Lists (hybrid model)**  
  Within a Workspace:  
  - **One primary List** per contact = current main pipeline stage (e.g., Leads, Prospects, Applications, Closed, Lost).  
  - **Multiple secondary Lists** = tags/segments (e.g., Hot Leads, Referred by John, Q3 Campaign).  
  - Changing primary List logs an event in the communication log:  
    “Primary List changed: Prospects → Applications on [date/time]”  
  - Secondary Lists added/removed independently (flexible filtering/reporting).

## 2. Contacts

**Uniqueness & Duplicates (within a Workspace)**  
- Duplicate detection: phone (any) OR email (any) match  
- On add/import: automatic merge prompt  
  - Side-by-side view  
  - Choose per-field values (existing vs new)  
  - Designate primary email / primary phone  
  - Keep secondary emails/phones with labels  
  - Options: Merge, Overwrite, Keep separate, Cancel

**Multiple emails & phones**  
- 1 primary email + 0+ secondary emails  
- 1 primary phone + 0+ secondary phones (with user-defined labels: Business, Personal, CA Mobile, HI Mobile, etc.)  
- Primary used for default actions (mail-merge, Twilio texting, display)

**Core fields**  
**Basic view** (list/cards):  
- ID  
- Created date/time  
- First name  
- Last name  
- Primary email  
- Primary phone  
- Company  
- Last contact date/time  

**Details page**:  
- All Basic fields  
- Secondary emails (list, promote to primary)  
- Secondary phones (list with labels)  
- Birthday  
- Marital status  
- Spouse (link to another contact in same Workspace)  
- Children’s names  
- Pet names  
- Referred by  
- Transaction / Loan File Notes (free-text, with link support)  
- Notes (rich text, timestamped)  
- Custom fields (user-defined per user/Workspace: text, date, dropdown, etc.)

**Sharing (between Andy & Monalisa)**  
- Per-contact checkbox: “Share with [other user]”  
- When enabled: read-only view in other user’s “Shared with Me” section  
- Viewer can “Save As” → creates independent copy in their chosen Workspace  
- Owner can revoke at any time (removes from shared view, copies remain)

## 3. Communication Log & Notices

**Log structure** (on Contact Details page)  
Organized into sections/tabs (collapsible or tabbed):  
1. All Activity (unified timeline)  
2. Emails  
3. Texts / SMS  
4. Phone Calls  
5. AI Interactions  
6. Stage & List Changes  
7. Notes & Manual Entries  
8. Other / System Events  

- Reverse chronological (newest first)  
- Each entry: timestamp, type icon, preview/snippet, expandable for full content  
- Stage changes auto-logged

**Pinned Notices (top of Details page)**  
- Last email sent: [date] via [Campaign]  
- Current campaign status  
- Shared status  
- Current primary List + last move  
- Pending AI drafts, bounces, upcoming birthdays, etc.

## 4. Templates

**Scope**  
- Workspace-specific (no cross-Workspace visibility by default)

**Reuse & Sharing**  
- Copy to another of your Workspaces  
- Share with Monalisa (read-only view + Save As to her Workspace)  
- Global Favorites Library (user-level): add templates from any Workspace → push copies to any Workspace later

**Creation Flow**  
- AI-first: prominent “Generate with AI” button  
- Prompt interface: large text area + quick chips + context auto-inclusion  
- Monalisa: Suggested Prompts sidebar with real-estate-tailored starters  
- Guided questions before prompt (goal, audience, tone, must-haves)  
- Manual creation option available but secondary  
- After generation: rich editor with image upload/URL + text overlay tool  
- Supported elements: subject, preheader, rich text, placeholders, links/buttons, signature, inline images

## 5. Campaigns

**Types**  
- One-off/immediate send  
- Single scheduled blast  
- Multi-step drip sequence (timed steps, exit conditions)

**Loan Factory only**  
- Mandatory approval for custom (non-company-portal) campaigns  
- Submit for Approval → Pending queue → Andy reviews/approves/rejects/edits

**Recipient selection**  
- Whole primary List  
- Filtered (last campaign >60 days, secondary tags, last contact >X days, etc.)  
- Manual checkbox  
- Exclusions (already received, Do Not Contact, etc.)  
- Saved/dynamic segments

**Smart triggers**  
- New Prospect/Leads → prompt to enroll in welcome campaign (default per List)  
- Inactive Prospects 60+ days → suggestion card with pre-filled re-engagement campaign  
- Holiday/broad → quick broad segments (all active, Prospects+Past Clients, etc.)

**Email providers** (per Workspace)  
- Loan Factory → Google Workspace  
- RateReady, MaiStory, AI Consulting → Mailgun  
- Family & Friends → Andy’s personal Microsoft 365  
- Monalisa’s Workspaces → her Coldwell Banker Microsoft 365

## 6. Twilio Texting

- Basic outbound + logging  
- Send from contact page or bulk  
- Use template or free-form  
- Log sent/received in communication log  
- Single From number (dedicated Twilio number)

## 7. Dashboard

**Priority order**  
1. Pending Approvals (Loan Factory focus)  
2. Recent Activity Needing Attention (bounces, replies, stalled, new shares)  
3. Todos / Action Items  
4. Recent Contacts / Hot Leads  
5. Active & Upcoming Campaigns  
6. AI Insights  
7. Calendar / Upcoming Events  
8. Quick Stats

## 8. CSV Import / Export (Simplified)

**Export**  
- From Workspace / List view  
- Default fields: First/Last Name, Primary Email/Phone, Company, Primary List, Secondary Tags, Created/Last Contact  
- Option to select fields

**Import**  
- Upload → quick column mapping  
- Assign primary List + optional tags  
- Skip invalid rows; warn on duplicates (email/phone match) → skip or create

## 9. Transactions / Loan File

**Simple combination**  
- Free-text field on Details: **Transaction / Loan File Notes** (paste IDs, status, links)  
- Changes auto-logged in communication log  
- Any transaction-related email sent from pi-crm auto-logs in communication log (with clickable URLs)

## 10. AI Monitoring & Suggestions

**Priorities**  
- Template insights & optimization  
- Guided questions before AI template creation  
- New tool / income idea brainstorming

**Delivery**  
- AI Insights section on Dashboard  
- Weekly summary email  
- Contextual banners (e.g., before template creation)

**Top features**  
- Template performance, usage patterns, duplication detection  
- 3–4 question wizard before AI generation (goal, audience, tone, must-haves)  
- Occasional high-confidence income ideas with revenue estimate & next steps

**Tone & controls**  
- Practical, actionable, dismissible  
- Limited to high-confidence items

## Authorization

**Strict Workspace isolation**
— users cannot see or access each other’s Workspaces unless explicitly shared  
- Shared contacts are read-only by default  
- Approval queue (Loan Factory) restricted to Andy  
- All actions logged with user ID and timestamp (audit trail)

## Data protection

**Sensitive fields**
- (phone, email, notes, transaction links) encrypted at rest if feasible (SQLite encryption extension or file-level encryption)  
- No storage of raw email credentials — use OAuth where possible (Google/Microsoft) or encrypted vault for SMTP/API keys 
- HTTPS enforced in production (Let’s Encrypt or self-signed on Pi)  
- Input sanitization / escaping to prevent XSS/SQL injection  
- CSRF protection on all POST/PUT/DELETE actions
- Implement API key for API usage in this app.

**Network & access**
- App runs on local network (Raspberry Pi) by default — no public exposure unless explicitly configured  
- If exposed (e.g., via reverse proxy + Cloudflare Tunnel / Tailscale / ngrok), require strong authentication and IP allow-listing  
- Firewall: restrict to LAN IPs or VPN only (ufw or similar)

## 12. BackupsGoals  

**Protect against hardware failure**
- (SD card corruption common on Raspberry Pi)  
- Allow easy restore or migration  
- Keep operation simple for home use

**Recommended backup strategy**
-Daily automated SQLite backup
- Nightly cron job: sqlite3 pi-crm.db ".backup /backups/pi-crm-$(date +%Y%m%d).db"  
- Keep last 7–30 daily backups (configurable)  
- Store on external S3 iDrive bucket

**External / off-device copies**
-rsync or simple script to copy backups to:  External USB drive attached to Pi  
Network share (NAS, another computer on LAN)  
- Cloud storage - iDrive bucket

- Frequency: daily or after significant changes

**Manual export fallback**  
- CSV export of all contacts (per Workspace) as emergency backup  
- Optional: export all templates, campaigns metadata (future)

**Restore process**
- Stop app  
- Replace pi-crm.db with backup copy  
- Restart app  
- (If cloud backup) download → copy to Pi → restore

**Monitoring & alerts**  
- Simple health check script: verify backup folder has recent files  
- Optional email alert if last backup > 48 hours old

**Implementation notes**
- Provide basic backup script + cron instructions in README  
- Optional in-app “Backup Now” button that triggers copy to configured folder  
- Do not rely on SQLite WAL mode alone — regular full backups are essential on SD card hardware


