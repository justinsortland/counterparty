# Tasks — Counterparty

## Phase 0 — Foundation

- [ ] Initialize Next.js 16 project (App Router, TypeScript)
- [ ] Set up Tailwind CSS + shadcn/ui
- [ ] Set up Supabase project (Postgres + Auth enabled)
- [ ] Set up Supabase Auth: sign in, sign up, session middleware, redirect logic
- [ ] Create Workspace + User + WorkspaceMember on first sign-in (server action)
- [ ] Set up Prisma with initial schema (all core entities + workspace ownership)
- [ ] Run first migration against Supabase
- [ ] Deploy skeleton to Vercel (env vars wired)

## Phase 1 — Counterparties + Contacts

- [ ] Counterparty list page (table with type, status, last activity)
- [ ] Counterparty create/edit form
- [ ] Counterparty detail page (shell with tabs: contacts, deals, notes, tasks)
- [ ] Contact create/edit form (linked to counterparty)
- [ ] Contact list within counterparty detail

## Phase 2 — Deals

- [ ] Deal list page (table with stage, counterparty, follow-up date)
- [ ] Deal create/edit form (linked to counterparty)
- [ ] Deal detail page (notes, tasks, activity)
- [ ] Stage update (quick-select on list and detail)
- [ ] Next follow-up date field with visual indicator (overdue, upcoming, not set)

## Phase 3 — Notes + Tasks

- [ ] Note create form (type, date, body) on counterparty and deal pages
- [ ] Note timeline view per counterparty
- [ ] Task create form with due date
- [ ] Task complete/uncomplete toggle
- [ ] Task list per counterparty and deal

## Phase 4 — Dashboard + Search

- [ ] Dashboard: active deals count, overdue tasks list, stale counterparties list
- [ ] Global search (counterparties, deals, contacts)
- [ ] Counterparty list filters (type, status, tag)
- [ ] Deal list filters (stage, counterparty)

## Phase 5 — Polish + Hardening

- [ ] Activity log: auto-record creates, stage changes, note additions
- [ ] Empty states for all list views
- [ ] Loading and error states
- [ ] Responsive layout (readable on smaller screens)
- [ ] Basic input validation and error handling
- [ ] Seed script for local development

## Backlog (V2+)

- [ ] Team/org support with RLS
- [ ] Email/calendar sync
- [ ] Kanban pipeline view for deals
- [ ] Reminders and notifications
- [ ] CSV import/export
- [ ] Document attachments

## Done

- [x] Define project direction and product brief
- [x] Choose tech stack (Next.js 16 + Supabase + Prisma + shadcn/ui)
- [x] Finalize auth (Supabase Auth), ownership model (Workspace), and V1 design decisions
- [x] Write PRD, Architecture, Tasks
- [x] Phase 0: Next.js scaffold, Tailwind, shadcn/ui, Prisma, Supabase Auth, workspace bootstrap, dashboard shell
- [x] Phase 1: Counterparty list, create, detail; contact list, create
- [x] Phase 2: Deal list, create, detail
- [x] Phase 4 (partial): Dashboard overview with stat cards, recent counterparties, deals by follow-up
- [x] Phase 3 (partial): Note create form and timeline on counterparty and deal pages
