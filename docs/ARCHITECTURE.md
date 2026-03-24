# Architecture — Counterparty

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (App Router) | Full-stack, server components, productizable |
| Database | Supabase (Postgres) | Relational model, RLS-ready for team support, generous free tier |
| ORM | Prisma | Type-safe, strong DX for relational model |
| Auth | Supabase Auth | Already in stack, JWT integrates with Postgres RLS |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) | Structured review output, best-in-class instruction following |
| UI | shadcn/ui + Tailwind CSS | Polished components with full control |
| Hosting | Vercel | Zero-config Next.js deploy |

## System Overview

```
Browser
  └── Next.js App (Vercel)
        ├── App Router (pages + layouts)
        ├── Server Components (data fetching via Prisma)
        ├── Server Actions (mutations + AI review trigger)
        ├── Supabase Auth middleware (session validation)
        ├── Prisma Client ──> Supabase Postgres
        └── Anthropic SDK ──> Claude API
```

Auth is handled by Supabase Auth. Session cookies are validated in Next.js middleware. All DB access goes through Prisma. AI reviews are triggered from server actions, which call the Anthropic SDK and store structured results in Postgres.

## Ownership Model

Unchanged from prior version. All entities belong to a **Workspace**.

```
User ──< WorkspaceMember >── Workspace ──< [Submission, Review, ReviewIssue]
```

For V1: 1 user, 1 workspace, created automatically at signup.
For V2: add `WorkspaceMember` entries, add RLS policies — no entity schema changes.

Ownership enforcement in V1 is at the application layer: every Prisma query filters by `workspaceId`.

## Key Files and Routes

| Path | Purpose |
|------|---------|
| `/app/(auth)` | Sign in / sign up pages (Supabase Auth) |
| `/app/(dashboard)/layout.tsx` | Main shell: sidebar, nav, workspace bootstrap |
| `/app/(dashboard)/dashboard` | Home: submission counts, critical issues, recent activity |
| `/app/(dashboard)/submissions` | Submission list page |
| `/app/(dashboard)/submissions/new` | Create submission form |
| `/app/(dashboard)/submissions/[id]` | Submission detail: scope, review history, issue list |
| `/lib/db.ts` | Prisma client singleton |
| `/lib/supabase/server.ts` | Supabase Auth server helpers |
| `/lib/workspace.ts` | `getWorkspaceId(userId)` helper |
| `/lib/bootstrap.ts` | Idempotent workspace creation on first login |
| `/lib/actions/submissions.ts` | Server actions: create, update submission |
| `/lib/actions/review.ts` | Server action: trigger AI review, parse, store |
| `/lib/ai/reviewer.ts` | Claude API call + structured output parsing |
| `/components/nav-links.tsx` | Sidebar nav (Dashboard, Submissions) |

## Data Model

### Workspace, User, WorkspaceMember
Unchanged. See prior version or `prisma/schema.prisma`.

### Submission
```
id              String           @id @default(cuid())
workspaceId     String
title           String           -- "Kitchen remodel at 123 Main St"
address         String
jurisdiction    String           -- "San Francisco, CA" (free text)
permitType      PermitType
projectType     ProjectType
scopeOfWork     String           -- plain text, full description of proposed work
status          SubmissionStatus @default(DRAFT)
createdAt       DateTime         @default(now())
updatedAt       DateTime         @updatedAt
```

### Review (append-only)
```
id              String          @id @default(cuid())
workspaceId     String
submissionId    String
revisionNumber  Int             -- 1, 2, 3… auto-incremented per submission
verdict         ReviewVerdict
summary         String          -- 1–3 sentence AI summary
missingDocs     String[]        -- list of missing documentation items
createdAt       DateTime        @default(now())
```

### ReviewIssue
```
id              String          @id @default(cuid())
reviewId        String
severity        IssueSeverity
category        String          -- "Egress", "Setback", "Fire separation", etc.
description     String          -- what the issue is and why it matters
codeReference   String?         -- "CBC Section 1030.2" — best-effort, not guaranteed
```

### Enums
```
SubmissionStatus  DRAFT | PENDING_REVIEW | REVIEWED | NEEDS_REVISION
PermitType        BUILDING | ELECTRICAL | PLUMBING | MECHANICAL | ZONING | GRADING
ProjectType       REMODEL | ADDITION | ADU | NEW_CONSTRUCTION | DECK_PATIO |
                  FENCE_WALL | POOL | DEMOLITION | OTHER
ReviewVerdict     LIKELY_APPROVE | CONDITIONAL | LIKELY_REJECT
IssueSeverity     CRITICAL | MAJOR | MINOR
```

## AI Review Engine

### Flow
1. User clicks "Request Review" on a submission detail page
2. Server action reads the full `Submission` record
3. Calls `lib/ai/reviewer.ts` with submission data
4. `reviewer.ts` builds a structured prompt and calls Claude via `@anthropic-ai/sdk`
5. Parses the JSON response into `{ verdict, summary, missingDocs, issues[] }`
6. Creates one `Review` row + N `ReviewIssue` rows in a transaction
7. Updates `submission.status` to `REVIEWED`
8. Redirects to submission detail page (reviews are now loaded)

### Prompt Strategy (V1)
- System: "You are a residential building plan checker for {jurisdiction}. Review this permit application strictly and identify all likely issues a plan checker would raise. Respond only with valid JSON matching the schema provided."
- User: structured block with permit type, project type, jurisdiction, and full scope of work
- Response schema provided inline in the prompt as a JSON schema comment
- Temperature: 0 (deterministic output for structured data)

### Model Selection
- Default: `claude-haiku-4-5-20251001` (fast, low cost, sufficient for structured review)
- Configurable via env var `REVIEW_MODEL` for testing with stronger models

### Parsing
- Parse AI JSON response in `lib/ai/reviewer.ts`
- If parsing fails: surface a user-facing error, do not create a broken review
- No retry logic in V1 — if it fails, user can re-request

## V1 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI output format | JSON with fixed schema | Structured issues are more useful than prose; easier to display |
| Review storage | Persisted to DB | Avoid re-generating on every load; user can see history |
| File uploads | Deferred to V2 | Avoids Supabase Storage setup; text-only is sufficient for V1 |
| Jurisdiction | Free text | No city database to maintain; AI knows local context from training |
| Code citations | Best-effort | Disclaimer shown in UI: citations are approximate, verify before submitting |
| Mutations | Server Actions | Consistent with existing app patterns |
| Ownership enforcement | Application layer (Prisma `where: { workspaceId }`) | Supabase RLS added in V2 |

## Open Questions

- Should scope of work updates create a new Submission record or just mutate the existing one? (Current plan: mutate in place, revision number tracks review iterations.)
- Should the "Request Review" button be disabled while a review is pending, or allow concurrent requests?
- Should critical-severity issues block the submission status from advancing to "Reviewed"?
