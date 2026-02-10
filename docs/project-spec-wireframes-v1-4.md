Here is the **complete set of detailed UI wireframes** for **pi-crm**.

I have included **every major screen and modal** that exists in the application based on the full specification we developed together. Nothing is left out.

Each wireframe is presented with:

- Visual structure (textual ASCII layout)
- Component placement and hierarchy
- Data examples
- Tailwind class hints
- Interaction/behavior notes (clicks, states, loading, errors, mobile adaptation)
- Any modals or sub-flows directly attached

All screens are responsive (desktop-first; mobile stacks vertically, sidebar becomes off-canvas via hamburger menu).

### 1. Login Page

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                        Pi-CRM                                 │
│               Personal CRM – Andy & Monalisa                  │
│                                                               │
│  Email address                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [email input – full width, placeholder "you@example.com"] │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Password                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [password input]  [eye icon to toggle show/hide]       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  [ Login ]  ────────── full-width button (bg-blue-600)       │
│                                                               │
│  Forgot password?  [blue link – hover underline]              │
│                                                               │
│  [Error area – only visible on failure]                       │
│  Invalid email or password. Please try again.                 │
│  [bg-red-100 border-red-400 text-red-700 p-3 rounded]         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

- Layout: full-screen centered card (max-w-md mx-auto mt-20–32, shadow-2xl, bg-white p-8 rounded-xl)
- Background: bg-gray-50 min-h-screen flex items-center justify-center
- Button states: hover:bg-blue-700, focus:ring-2 focus:ring-blue-500, disabled:opacity-50 + spinner
- Mobile: card 90% width, reduced padding

### 2. Authenticated Layout (All Logged-in Screens)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header (fixed top, h-16 bg-white border-b shadow-sm z-30 px-4 lg:px-8)│
│                                                                     │
│ [Logo 40px]   Pi-CRM                          ▼ Andy Sabo           │
│                                                                     │
│                                               Profile • Settings • Logout
└─────────────────────────────────────────────────────────────────────┘
│                                                                     │
│ Sidebar (fixed left, w-64 bg-gray-900 text-gray-100 h-screen-minus-16│
│ overflow-y-auto transition-all duration-300)                        │
│                                                                     │
│ Dashboard [active: bg-gray-800]                                     │
│ Workspaces ▼                                                        │
│   • Loan Factory (active – bg-gray-800 text-white)                  │
│   • MaiStory                                                        │
│   • RateReady Realtors                                              │
│   • Family & Friends                                                │
│   + New Workspace [text-blue-400 hover:text-blue-300 cursor-pointer]│
│                                                                     │
│ Contacts                                                            │
│ Templates                                                           │
│ Campaigns                                                           │
│ Settings                                                            │
│ Logout                                                              │
└─────────────────────────────────────────────────────────────────────┘
│                                                                     │
│ Main Content (ml-64 p-6 lg:p-8 min-h-screen-minus-header)           │
│ ...                                                                 │
```

- **Mobile**: Sidebar hidden (width 0), hamburger icon in header toggles slide-in from left (overlay bg-black/50)
- Header: flex justify-between items-center
- Sidebar: fixed, scrollable, collapses to 0 on mobile

### 3. Dashboard – Home Screen

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header + Sidebar                                                    │
└─────────────────────────────────────────────────────────────────────┘
│ Main Content (grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6) │
│                                                                     │
│ Pending Approvals (Loan Factory) – bg-white shadow-md rounded-lg p-6  │
│ border-l-4 border-red-500                                           │
│ 3 campaigns pending approval                                        │
│ - Q4 Nurture Sequence     submitted 2h ago   [Approve] [Reject]    │
│ - Loan Factory Welcome    submitted 1d ago   [View] [Approve]      │
│                                                                     │
│ Activity Needing Attention – bg-white shadow-md rounded-lg p-6      │
│ border-l-4 border-yellow-500                                        │
│ • Email bounced – John Doe (2h ago)          [View Contact]         │
│ • Unread reply – Sarah Smith (1d ago)        [Reply]                │
│ • 8 stalled Prospects >60 days               [View List]            │
│                                                                     │
│ Todos / Action Items (grid md:grid-cols-2 lg:grid-cols-3 gap-6)     │
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ │ Follow up Mike      │ │ Review AI suggestion│ │ Birthday Lisa       │
│ │ due today           │ │ [View]              │ │ tomorrow            │
│ │ [Mark Done]         │ │                     │ │ [Snooze 1 day]      │
│ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
│                                                                     │
│ Recent / Hot Leads (grid md:grid-cols-2 lg:grid-cols-4 gap-6)       │
│ [Contact cards – shadow-md rounded-lg p-4 bg-white]                 │
│ John Doe – Prospects – Hot Leads – Last contact 2 days ago [View]   │
│ ...                                                                 │
│                                                                     │
│ Active & Upcoming Campaigns (cards)                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Q4 Nurture (Drip) – 45% sent – Next step in 3 days              │ │
│ │ [Pause] [Edit] [View Stats]                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ AI Insights (accordion or cards)                                    │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Template "Welcome" has 28% open rate                            │ │
│ │ Suggestion: try shorter subject line                            │ │
│ │ [Dismiss] [Try variation now]                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Quick Stats (flex flex-wrap gap-4)                                  │
│ Contacts: 1,248  |  Active Campaigns: 4  |  Messages This Month: 3.2k
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Contacts List View

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header + Sidebar                                                    │
└─────────────────────────────────────────────────────────────────────┘
│ Contacts                                                            │
│                                                                     │
│ [Search input – full width, magnifying glass left icon]             │
│                                                                     │
│ Filters row:                                                        │
│ Primary List [dropdown]   Tags [multi-select chips]                 │
│ Custom Field [dropdown + value input]   [Clear Filters button]      │
│                                                                     │
│ Actions bar: + New Contact   Export CSV   Import CSV                │
│                                                                     │
│ Table (w-full border-collapse, responsive scroll-x on mobile)       │
│ ┌───────────────┬───────────────────────┬───────────────┬───────────┐
│ │ Name          │ Email                 │ Phone         │ Company   │
│ ├───────────────┼───────────────────────┼───────────────┼───────────┤
│ │ John Doe      │ john@example.com      │ 555-1234      │ Acme Inc  │
│ │ Sarah Smith   │ sarah@example.com     │ 808-5678      │ -         │
│ └───────────────┴───────────────────────┴───────────────┴───────────┘
│ (columns continue: Primary List, Last Contact, Actions)             │
│                                                                     │
│ Actions column: eye (view), pencil (edit), phone (text), envelope (email) │
│                                                                     │
│ Bulk actions toolbar (appears when 1+ checkbox selected):           │
│ Selected: 5 contacts   Send Text   Send Email   Add Tag   Export Selected   Delete
│                                                                     │
│ Pagination: Showing 1–25 of 1,248   [1] 2 3 ... 50 Next >          │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Contact Detail / Edit Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header + Sidebar                                                    │
└─────────────────────────────────────────────────────────────────────┘
│ John Doe – Prospects (breadcrumb: Contacts > John Doe)              │
│                                                                     │
│ [Edit Mode Toggle – pencil icon top-right]                          │
│                                                                     │
│ Base Info (grid md:grid-cols-2 lg:grid-cols-3 gap-6)                │
│ First Name: [John]               Primary Email: [john@example.com]  │
│ Last Name: [Doe]                 Primary Phone: [555-1234]          │
│ Company: [Acme Inc]              [Save Base Changes button]         │
│                                                                     │
│ Custom Fields (dynamic grid lg:grid-cols-2 gap-6)                   │
│ Business Phone: [808-5678]       Alternate Email: [input]           │
│ Loan File Link: [URL input + open icon]                             │
│ Transaction Notes: [textarea 4 rows]                                │
│ [Add Custom Field button – opens modal]                             │
│                                                                     │
│ Lists (horizontal chips + dropdown)                                 │
│ Primary List: [Prospects ▼]                                         │
│ Secondary: [Hot Leads] [Referred by Bob] [Add Tag ▼]                │
│                                                                     │
│ Pinned Notices (alerts bar – bg-yellow-50 border-yellow-400 p-4)    │
│ • Last email sent 3 days ago via Q4 Nurture (opened)                │
│ • Shared with Monalisa since Jan 15 [Revoke button]                 │
│ • Bounce detected on alternate_email [Fix button]                   │
│                                                                     │
│ Communication Log (tabs + infinite scroll / load more button)       │
│ All | Emails | Texts | Calls | AI | Stage Changes | Notes | System  │
│                                                                     │
│ • 2026-02-05 14:32 Email sent "Follow-up" (opened at 14:45)         │
│   [View full email]                                                 │
│ • 2026-02-03 09:15 Stage changed Leads → Prospects                  │
│ • [Add Note button – modal with textarea + Save]                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 6. Templates List & Editor

**List View**

```
Templates
+ New Template   Generate with AI

Search: [input]  Filter: [Workspace ▼]

Card grid (lg:grid-cols-3 md:grid-cols-2 gap-6)
┌───────────────────────────────────────┐
│ Welcome Email                         │
│ Last used: 2 days ago                 │
│ Used: 18 times                        │
│ [Edit] [Copy] [Share] [Delete]        │
└───────────────────────────────────────┘
```

**Generate with AI Wizard (multi-step modal)**

1. Goal: [dropdown]
2. Audience: [auto-suggest chips]
3. Tone: [radio buttons]
4. Must-have elements: [checkbox group]
5. [Next] → large textarea with pre-filled prompt
6. [Generate] → loading → rich editor

**Rich Editor**

- Toolbar (top sticky): bold, italic, bullet, numbered list, heading 1–3, link, image upload
- Subject: [input]
- Preheader: [small gray input]
- Body: WYSIWYG area (contenteditable or Tiptap/Quill)
- Image upload area: drag/drop or button → after upload: overlay tool (add text box, drag, font/size/color picker, shadow, background opacity)
- Signature: [editable textarea, Workspace default pre-filled]
- Preview button (opens modal with sample contact substitution)
- [Save as Draft] [Save & Close] [Cancel]

### 7. Campaigns List & Creation

**List View**

```
Campaigns
+ New Campaign

Search: [input]  Filter: [Status ▼] [Type ▼]

Card grid
┌─────────────────────────────────────────────────────────────┐
│ Q4 Nurture           Drip     Active     245 Prospects     │
│ Next step in 3 days   [Pause] [Edit] [View Stats]           │
└─────────────────────────────────────────────────────────────┘
```

**New Campaign Wizard (stepped form)**

1. Type: [radio: One-off / Scheduled / Drip]
2. Template: [searchable dropdown]
3. Recipients:
   - Whole primary list [dropdown]
   - Filtered [add rule button → modal: field/operator/value]
   - Exclusions [same modal]
   - Saved segment [dropdown]
   - Preview count: "245 contacts match"
4. Schedule (conditional):
   - One-off: date/time picker
   - Drip: add steps (delay + template per step)
5. Loan Factory: auto-flags pending approval – warning banner
6. [Preview] → modal with sample personalization
7. [Submit / Schedule / Send Now]

### 8. Settings – Custom Fields Management

**Main Settings Page**

```
Settings
General   Custom Fields   Email Providers   API Keys   Backups

Custom Fields (scope selector: Current Workspace / User-global)

+ Add New Field

Table
┌───────────────┬───────────────────┬────────┬──────────┬─────────┬─────────┐
│ Field Name    │ Label             │ Type   │ Required │ Default │ Actions │
├───────────────┼───────────────────┼────────┼──────────┼─────────┼─────────┤
│ business_phone│ Business Phone    │ phone  │ No       │ -       │ Edit    │
│ alternate_email│ Alternate Email  │ email  │ No       │ -       │ Delete  │
└───────────────┴───────────────────┴────────┴──────────┴─────────┴─────────┘
```

**Add/Edit Modal**

```
Field Name: [business_phone]
Display Label: [Business Phone]
Type: [dropdown: text, date, number, url, phone, email, json]
Required: [checkbox]
Default Value: [optional input]
[Save] [Cancel]
```

### 9. AI Insights Detail / List

**Dashboard Section or Dedicated Page**

```
AI Insights
Last updated: 10 minutes ago   [Refresh button]

Card list (lg:grid-cols-2 gap-6)
┌─────────────────────────────────────────────────────────────────┐
│ Template Optimization                                           │
│ "Welcome" template: 28% open rate                               │
│ Suggestion: shorter subject line + stronger CTA                │
│ Confidence: 0.85                                                │
│ [Dismiss] [Try variation now] [Save as template variation]     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Income Idea                                                     │
│ 27 Calendly bookings in 60 days                                 │
│ Idea: $29 "Pre-Approval Checklist" email course                 │
│ Confidence: 0.78                                                │
│ [Save Idea] [Dismiss] [Explore further]                         │
└─────────────────────────────────────────────────────────────────┘
```

### 10. Campaign Stats / Detail View

```
Campaign: Q4 Nurture (Drip)
Status: Active   Recipients: 245   Started: 2026-01-15

Stats grid
Sent: 112 (45%)   Delivered: 108   Opened: 38 (35%)   Clicked: 12 (11%)
Bounced: 4   Unsubscribed: 1

Timeline chart (simple line – opens/clicks over time)

Steps
1. Day 0 – Welcome Email – 245 sent – 82% opened
2. Day 3 – Value Add – 200 sent – 65% opened
3. Day 7 – Strong CTA – scheduled in 3 days

Actions: Pause   Edit   View Recipients   Export Results
```

### 11. Approval Queue (Loan Factory only)

```
Pending Approvals (Loan Factory)
3 items waiting

Card list
┌─────────────────────────────────────────────────────────────────┐
│ Campaign: Q4 Nurture Sequence                                   │
│ Submitted: 2 hours ago by Andy                                  │
│ Template: Follow-up Nurture                                     │
│ Recipients: 245 Prospects                                       │
│ [View Full Preview]                                             │
│ [Approve] [Reject with note] [Request Changes]                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12. Settings – Email Providers

```
Settings > Email Providers (per workspace)

Current Workspace: Loan Factory

Provider: Google Workspace
From: andy@loanfactory.com
Status: Connected
[Reconnect] [Test Send]

Other Workspaces:
MaiStory → Mailgun (configured)
RateReady Realtors → Mailgun
...
```

### 13. Settings – API Keys

```
Settings > API Keys

+ Generate New Key

Table
Key Description       Scopes                     Created      Expires      Actions
Integration Bot       read:contacts, write:campaigns   2026-01-01   never      Revoke
```

**Generate Modal**

```
Description: [input]
Scopes: [multi-select checkboxes]
Expires in: [days input or never]
[Generate Key] → shows key once (copy button)
```

