# Tasks — Counterparty

## Phase 0 — Migration from CRM shell

- [ ] Delete CRM routes: `/counterparties/**`, `/deals/**`
- [ ] Delete CRM components: `notes-section.tsx`
- [ ] Delete CRM server actions: `lib/actions/notes.ts`
- [ ] Update `components/nav-links.tsx`: replace CRM links with Submissions
- [ ] Update Prisma schema: drop CRM models and enums, add new models
- [ ] Run Prisma migration (destructive reset — dev only, no production data)
- [ ] Rewrite dashboard page shell (remove CRM stat cards, placeholder for new stats)

## Phase 1 — Submissions CRUD

- [ ] Submission list page (`/submissions`): table with title, permit type, project type, status, latest verdict, date
- [ ] New submission form (`/submissions/new`): title, address, jurisdiction, permit type, project type, scope of work
- [ ] Create submission server action (`lib/actions/submissions.ts`)
- [ ] Submission detail page (`/submissions/[id]`): scope of work display, status badge, review history section (placeholder)
- [ ] Edit scope of work: inline edit or edit page for scope of work field

## Phase 2 — AI Review Engine

- [ ] Install `@anthropic-ai/sdk`, add `ANTHROPIC_API_KEY` to env
- [ ] Write `lib/ai/reviewer.ts`: build prompt, call Claude, parse structured JSON response
- [ ] Write `lib/actions/review.ts` server action: validate submission, call reviewer, persist Review + ReviewIssues in transaction, update submission status
- [ ] "Request Review" button on submission detail page
- [ ] Display review result: verdict badge, summary text, issues grouped by severity (Critical → Major → Minor), missing docs list
- [ ] Review history: all past reviews shown in reverse order with revision number and date

## Phase 3 — Dashboard

- [ ] Stat cards: total submissions, submissions needing revision (NEEDS_REVISION), critical issues flagged across all active submissions
- [ ] Recent submissions table: title, latest verdict, status, last updated
- [ ] Empty state: prompt to create first submission

## Phase 4 — Polish

- [ ] Loading states on review request (button disabled + spinner while AI call is in flight)
- [ ] Error state if AI review fails (user-facing message, retry available)
- [ ] Disclaimer on all review output: "AI-generated review — citations are approximate. Verify requirements with your local authority."
- [ ] Empty states for all list views
- [ ] Submission status transitions: auto-update status based on verdict (REVIEWED → NEEDS_REVISION if any CRITICAL issues)
- [ ] Responsive layout

## Backlog (V2+)

- [ ] File and PDF uploads (plans, photos, specs) — AI reviews actual documents
- [ ] Jurisdiction-specific checklists (pre-load known local requirements)
- [ ] Export review summary as PDF
- [ ] Team/workspace access for multiple users
- [ ] Saved scope of work templates for common project types
- [ ] Hyperlinked code references
- [ ] API access for permit expediters

## Done

- [x] Next.js 16 scaffold, Tailwind, shadcn/ui, Prisma, Supabase Auth
- [x] Workspace + User + WorkspaceMember bootstrap on signup
- [x] Dashboard shell with sidebar nav, sign-out
- [x] Supabase Auth SSR: login, signup, middleware, callback
- [x] Rewrite product direction: CRM → permit review AI simulator
- [x] Rewrite PRD, Architecture, Tasks for new direction
