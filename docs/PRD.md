# PRD — Counterparty

## Problem

Getting a residential permit is opaque and adversarial. Most homeowners and small contractors don't know what plan checkers are looking for. First submissions routinely get rejected for missing documents, code violations, or incomplete scope descriptions. Multiple trips to city hall add weeks to a project and real money in delays.

There is no low-cost way to pressure-test a permit application before submitting it. The counterparty — the permitting authority — holds all the information about what they want, and they only reveal it by rejecting you.

## Concept

Counterparty is an AI-powered permit review simulator for residential construction and renovation. The name is intentional: the permitting authority is literally the counterparty in your project. Counterparty puts you on the other side of that table before you show up at city hall.

Users describe their project — scope of work, address, permit type, jurisdiction. The AI plays the role of a residential plan checker and reviews the submission: flagging likely rejection points, identifying missing documentation, citing relevant code sections, and giving an overall verdict. Users can revise and re-request a review until the submission looks clean.

## Goals

- Let users simulate the permit review process before submitting to the real authority
- Surface likely rejection points and missing documentation before it costs time
- Educate users on what plan checkers actually evaluate
- Build confidence for the real submission

## Non-Goals (V1)

- No actual permit submission or filing with any authority
- No file or PDF upload (V2)
- No jurisdiction database or code book — AI cites codes from training knowledge
- No collaboration or team access
- No notifications or reminders
- No mobile app

## Users

**Primary:** Homeowners planning a renovation or addition, and small residential contractors managing permit applications on behalf of clients.

**Secondary (V2):** Permit expediters, architects, and small design-build firms who submit many permits and want to pre-screen submissions before paying their staff to go to the counter.

## Core Entities

| Entity | Description |
|--------|-------------|
| Submission | A permit application packet: one project, one jurisdiction, one scope of work |
| Review | An AI-generated review of a submission (append-only; one per review request) |
| ReviewIssue | A specific flag within a review: severity, category, description, optional code cite |

## MVP Features

### Submissions
- Create a submission with: title, address, jurisdiction (free text), permit type, project type, scope of work (plain text)
- Edit scope of work before requesting a review
- List all submissions with status and latest verdict
- Submission statuses: Draft, Pending Review, Reviewed, Needs Revision

### AI Review
- Request a review from the submission detail page
- AI acts as a residential plan checker for the given jurisdiction
- Returns: overall verdict (Likely Approve / Conditional / Likely Reject), 1–3 sentence summary, list of issues, list of missing documents
- Issues include: severity (Critical / Major / Minor), category (e.g., "Egress", "Setback"), description, optional code reference
- Each review request creates a new Review with an incremented revision number
- Full review history shown on the submission detail page

### Dashboard
- Count of active submissions, submissions needing revision, critical issues flagged
- Table of recent submissions with latest verdict

## Future Features (V2+)

- File and PDF uploads (plans, photos, specs) — AI reviews the actual documents
- Jurisdiction database: pre-load known local requirements by city/county
- Code book references: hyperlinked to actual building code sections
- Checklist templates per permit type and jurisdiction
- Export review summary as PDF (for use in real submission cover letter)
- Team access (multiple users per workspace)
- Saved scope of work templates for common project types
- API access for permit expediters building their own workflows

## Permit Types (V1)

- Building (general construction)
- Electrical
- Plumbing
- Mechanical (HVAC)
- Zoning / Land Use
- Grading / Drainage

## Project Types (V1)

- Kitchen or Bath Remodel
- Room Addition
- ADU (Accessory Dwelling Unit)
- Deck or Patio
- Fence or Retaining Wall
- Pool or Spa
- New Construction
- Demolition
- Other

## Constraints

- Single developer building MVP
- No budget for paid infrastructure until value is proven
- Supabase free tier + Vercel hobby tier + Anthropic API covers MVP
- Text-only submissions in V1 — no file storage

## Resolved Decisions

| Decision | Choice |
|----------|--------|
| Auth | Supabase Auth — unchanged from prior version |
| Ownership | Workspace model — unchanged; 1 user = 1 workspace for MVP |
| Scope of work input | Plain textarea, no rich text editor |
| Jurisdiction | Free text field, no structured database |
| AI model | Claude (haiku for cost, sonnet for quality — configurable) |
| Review storage | Stored in DB (Review + ReviewIssue rows), not re-generated on load |
| Code citations | Best-effort from AI training knowledge; explicitly not guaranteed accurate |
