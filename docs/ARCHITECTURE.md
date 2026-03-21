# Architecture — Counterparty

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (App Router) | Full-stack, server components, productizable |
| Database | Supabase (Postgres) | Relational model, RLS-ready for team support, generous free tier |
| ORM | Prisma | Type-safe, strong DX for relational entity graph |
| Auth | Supabase Auth | Already in stack, JWT integrates with Postgres RLS, no second service needed |
| UI | shadcn/ui + Tailwind CSS | Polished components (tables, chips, modals) with full control |
| Hosting | Vercel | Zero-config Next.js deploy |

Clerk was considered but rejected for MVP: its main advantages (advanced org UI, pre-built team management) are not needed at this stage, and it adds an unnecessary external dependency when Supabase Auth covers the requirement.

## System Overview

```
Browser
  └── Next.js App (Vercel)
        ├── App Router (pages + layouts)
        ├── Server Components (data fetching via Prisma)
        ├── Server Actions (mutations)
        ├── Supabase Auth middleware (session validation)
        └── Prisma Client
              └── Supabase Postgres
```

Auth is handled entirely by Supabase Auth. Session cookies are validated in Next.js middleware. All DB access goes through Prisma. No separate backend service in V1.

## Ownership Model

All core entities belong to a **Workspace**. For MVP, each user gets exactly one workspace created automatically at signup. This is the minimal change that makes future team support possible without a data migration.

```
User ──< WorkspaceMember >── Workspace ──< [all entities]
```

For V1: 1 user, 1 workspace, automatic.
For V2: add `WorkspaceMember` entries for additional users, add RLS policies — no entity schema changes.

**Ownership enforcement in V1** is done at the application layer: every Prisma query filters by `workspaceId` derived from the authenticated user's session. Supabase RLS is not enforced in V1 (Prisma uses the service role key which bypasses RLS), but will be added in V2 as a defense-in-depth layer.

## Key Components

| Component | Description |
|-----------|-------------|
| `/app/(auth)` | Sign in / sign up pages (Supabase Auth UI) |
| `/app/(dashboard)` | Main app shell: sidebar, nav, layout |
| `/app/counterparties` | Counterparty list + detail pages |
| `/app/deals` | Deal list + detail pages |
| `/app/contacts` | Contact list + detail pages |
| `/app/dashboard` | Home: active deals, overdue tasks, stale counterparties |
| `/components/ui` | shadcn/ui components (table, badge, dialog, etc.) |
| `/lib/db.ts` | Prisma client singleton |
| `/lib/auth.ts` | Supabase Auth server helpers (getUser, requireAuth) |
| `/lib/actions` | Server actions for mutations |

## Data Model

### Workspace
```
id          String    @id @default(cuid())
name        String
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```

### User
```
id           String   @id  // matches Supabase auth.users.id (UUID)
email        String   @unique
name         String?
createdAt    DateTime @default(now())
```

### WorkspaceMember (join — used for V2 team support, created at signup for V1)
```
id           String   @id @default(cuid())
workspaceId  String
userId       String
role         Enum     // owner | member | viewer
createdAt    DateTime @default(now())

@@unique([workspaceId, userId])
```

### Counterparty
```
id              String    @id @default(cuid())
workspaceId     String
name            String
type            Enum      // company | fund | vendor | client | recruiter | individual
status          Enum      // active | watch | inactive
website         String?
description     String?
tags            String[]  // freeform strings
lastActivityAt  DateTime?
createdAt       DateTime  @default(now())
updatedAt       DateTime  @updatedAt
```

### Contact
```
id               String   @id @default(cuid())
workspaceId      String
counterpartyId   String
name             String
title            String?
email            String?
phone            String?
linkedinUrl      String?
notes            String?
createdAt        DateTime @default(now())
updatedAt        DateTime @updatedAt
```

### Deal
```
id               String    @id @default(cuid())
workspaceId      String
counterpartyId   String
name             String
type             String?   // investment | partnership | vendor | job | other
stage            Enum      // prospect | active | diligence | closed_won | closed_lost | paused
value            Float?
currency         String?   @default("USD")
nextFollowUpAt   DateTime?
createdAt        DateTime  @default(now())
updatedAt        DateTime  @updatedAt
```

### Note
```
id               String   @id @default(cuid())
workspaceId      String
counterpartyId   String
dealId           String?
contactId        String?
type             Enum     // meeting | call | email | message | other
date             DateTime
body             String   // plain text, no rich text editor in V1
createdAt        DateTime @default(now())
updatedAt        DateTime @updatedAt
```

### Task
```
id               String    @id @default(cuid())
workspaceId      String
counterpartyId   String
dealId           String?
contactId        String?
title            String
dueAt            DateTime?
completedAt      DateTime?
createdAt        DateTime  @default(now())
updatedAt        DateTime  @updatedAt
```

### ActivityLog
```
id               String   @id @default(cuid())
workspaceId      String
entityType       String   // counterparty | deal | contact | note | task
entityId         String
action           String   // created | updated | stage_changed | note_added | task_completed
metadata         Json?
createdAt        DateTime @default(now())
```

## V1 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tags | Freeform `String[]` | Simpler to build; structured taxonomy is a V2 concern |
| Stale threshold | Hardcoded 30 days | Configurable per-workspace is a V2 setting |
| Note body | Plain `String` textarea | Rich text (Tiptap/Lexical) deferred to V2 |
| Ownership enforcement | Application layer (Prisma `where: { workspaceId }`) | Supabase RLS added in V2 as defense-in-depth |
| Mutations | Server Actions | Simpler than dedicated API routes for V1 scale |

## Open Questions

- Full-text search: Postgres `tsvector` or client-side filter for MVP? (Client-side is fine until >500 records.)
- Activity log: auto-generate in Server Actions (manual) or via Postgres trigger?
