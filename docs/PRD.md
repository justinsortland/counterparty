# PRD — Counterparty

## Problem

External relationship management is fragmented. Analysts, founders, investors, and operators track counterparties across spreadsheets, Notion docs, scattered notes, and email threads. The result: statuses go stale, follow-ups get missed, and there is no single structured view of where a relationship or deal stands.

Existing tools are either too generic (Notion, spreadsheets), too heavy (Salesforce, DealCloud), or not designed for individual operators managing a mixed portfolio of relationships (investors, vendors, clients, recruits, partners).

## Goals

- Give a single operator (or small team) one place to manage all external relationships and deals
- Surface what needs attention: stale counterparties, overdue follow-ups, open tasks
- Make it fast to log an interaction and fast to get a status snapshot
- Feel professional and structured, not like a hacked-together spreadsheet

## Non-Goals (V1)

- No contract signing or document workflow
- No real-time collaboration or live cursors
- No risk/exposure engine or portfolio analytics
- No public marketplace or directory
- No heavy document storage or PDF management
- No email/calendar integration (V2+)
- No mobile app

## Users

**Primary:** Individual operators — analysts, founders, investors, recruiters — who manage 10–200 ongoing external relationships and need a structured, low-friction system.

**Future:** Small teams (2–10) sharing a counterparty book. The data model uses a Workspace ownership layer from day one — team support requires no entity schema changes, only adding members and RLS policies.

## Core Entities

| Entity | Description |
|--------|-------------|
| Counterparty | A company, fund, vendor, client, or individual you have an ongoing relationship with |
| Contact | A person at or associated with a counterparty |
| Deal | An opportunity, engagement, or initiative linked to a counterparty |
| Note | A logged interaction: meeting, call, email, or memo |
| Task | A follow-up action with a due date |
| Activity Log | Auto-generated audit trail of changes and events |

## MVP Features

### Counterparties
- Create, edit, archive counterparties
- Fields: name, type (company/fund/vendor/client/recruiter/individual), status (active/watch/inactive), website, tags, description
- View all contacts, deals, notes, and tasks linked to a counterparty

### Contacts
- Add contacts linked to a counterparty
- Fields: name, title, email, phone, LinkedIn URL, notes

### Deals
- Create deals linked to a counterparty
- Fields: name, type, stage (prospect → active → diligence → closed won/lost/paused), value (optional), next follow-up date, notes
- Update stage and follow-up date quickly

### Notes
- Log a note against a counterparty, deal, or contact
- Fields: type (meeting/call/email/message/other), date, body (rich text or plain)
- Shown in chronological timeline per counterparty

### Tasks
- Create tasks linked to a counterparty or deal
- Fields: title, due date, done/not done
- Surface overdue and upcoming tasks in the dashboard

### Dashboard
- Summary view: active deals, overdue tasks, stale counterparties (no activity in X days)
- Quick-add for counterparties, notes, tasks

### Search & Filter
- Global search across counterparties, contacts, deals
- Filter counterparty list by type, status, tag
- Filter deal list by stage, counterparty

## Future Features (V2+)

- Team access with role-based permissions
- Email / calendar sync (log interactions automatically)
- Pipeline board view (kanban for deals)
- Reminders and notifications
- CSV import/export
- Document attachments
- API / webhook support
- Mobile-optimized view

## Constraints

- Single developer building MVP
- Start as internal-style tool, with productization path
- No budget for paid infrastructure until it proves value
- Supabase free tier + Vercel hobby tier should cover MVP comfortably

## Resolved Decisions

| Decision | Choice |
|----------|--------|
| Auth | Supabase Auth (no Clerk) |
| Ownership | Workspace model from day one; 1 user = 1 workspace for MVP |
| Tags | Freeform strings |
| Stale threshold | Hardcoded 30 days |
| Note body | Plain textarea, no rich text editor |

## Open Questions

- Should deal value be required or fully optional? (Currently optional — keep?)
- Should the activity log be user-visible or internal-only for V1?
