# Technical Reference: Counterparty

## Scope

This document describes the current built system. `docs/ARCHITECTURE.md` is an earlier planning document written before implementation; it does not accurately reflect the built system and should not be used as a reference for the current code.

## Tech Stack

- **Framework:** Next.js 16 (App Router): server components, server actions, file-based routing
- **Language:** TypeScript: end-to-end type safety across server and client
- **UI:** React 19 + Tailwind CSS + shadcn primitives: utility-first CSS, accessible component base
- **Auth:** Supabase Auth: session cookies validated in Next.js middleware
- **Database:** Supabase Postgres: relational storage for all application data
- **ORM:** Prisma: type-safe DB access, migration support
- **AI:** Anthropic Claude (`@anthropic-ai/sdk`): structured JSON review output at temperature 0
- **Hosting:** Vercel: zero-config Next.js deployment

## System Overview

```
Browser
  └── Next.js App (Vercel)
        ├── App Router: server components read data via Prisma
        ├── Server actions: mutations (submissions, artifacts, templates)
        │     └── AI review action: reads submission + artifacts
        │           └── Anthropic SDK ──> Claude API
        │                 └── parses JSON, persists Review + Issues
        ├── Supabase Auth middleware: validates session on every request
        └── Prisma Client ──> Supabase Postgres
                                (Submission, Review, ReviewIssue,
                                 Artifact, SubmissionTemplate, Workspace)
```

Artifact files are referenced via a `storagePath` string field stored in Postgres. The application reads and writes file metadata through Prisma. No OCR or content extraction is performed on uploaded files.

Auth is entirely handled by Supabase Auth. The middleware (`middleware.ts`) validates the session cookie on every protected route. All data access goes through Prisma with a `workspaceId` filter on every query.

## Ownership and Data Scope

All entities belong to a `Workspace`. The relation tree is:

```
User ──< WorkspaceMember >── Workspace
                               ├── Submission ──< Review ──< ReviewIssue
                               │                ──< Artifact
                               └── SubmissionTemplate
```

For the current MVP: one user, one workspace. The workspace is created automatically on first login via `lib/bootstrap.ts`. The `WorkspaceMember` join table is in place so that adding multi-user access in a future version requires only new membership rows and Supabase RLS policies, with no entity schema changes.

Ownership enforcement is at the application layer. Every Prisma query that reads or writes application data includes a `where: { workspaceId }` filter. Supabase RLS is not enforced; the workspaceId filter in application code is the sole ownership boundary in the current version.

## User Flow

1. **Signup / login.** Supabase Auth handles credential creation and session issuance. On first login, `bootstrapWorkspace()` creates a `User`, a `Workspace`, and a `WorkspaceMember` row in a single transaction.

2. **Create a submission.** The user fills in title, address, jurisdiction, permit type, project type, scope of work, and optional reviewer context. A `Submission` row is created with `status: DRAFT`.

3. **Attach artifacts.** The user uploads plan documents, labeling each with a document type from a profile-specific list (e.g., "Dimensioned site plan showing property lines, setbacks, and both structures"). Each file is stored in Supabase Storage; file metadata is persisted as an `Artifact` row linked to the submission.

4. **Request an AI review.** The user clicks "Request Review" on the submission detail page. A server action reads the submission and its artifact list, selects a review profile, computes document coverage, builds a structured prompt, and calls the Claude API.

5. **Persist review and issues.** The parsed AI response is written to Postgres in a single transaction: one `Review` row and one `ReviewIssue` row per flagged issue.

6. **Update submission status.** In the same transaction, `submission.status` is updated based on the review result: `NEEDS_REVISION` if any CRITICAL issue was flagged, `REVIEWED` otherwise.

7. **Revise submission.** The user edits scope of work or attaches additional documents. No new `Submission` row is created; revisions are tracked by requesting a new review, which increments the `revisionNumber`.

8. **Compare revisions.** The compare page takes two review revisions and computes a delta: resolved issues, persisted issues, newly introduced issues, and changes to the missing-document list.

9. **Printable report.** Each review revision has a formatted report page that can be printed or saved as a PDF via the browser.

10. **Templates.** Users can save a `SubmissionTemplate` with pre-filled scope language, permit type, project type, and jurisdiction. Selecting a template on the new submission form pre-fills those fields.

11. **Dashboard.** The dashboard aggregates active submission counts, needs-revision counts, open critical issues, and shows recent submissions and reviews.

## Data Model

The schema is in `prisma/schema.prisma`. Key models:

### Submission

```
id              String           @id @default(cuid())
workspaceId     String
title           String
address         String
jurisdiction    String           (free text; AI uses it to set jurisdiction context)
permitType      PermitType
projectType     ProjectType
scopeOfWork     String
reviewContext   String?          (optional: prior objections, focus areas, extra context)
status          SubmissionStatus @default(DRAFT)
createdAt       DateTime         @default(now())
updatedAt       DateTime         @updatedAt
```

### Review (append-only; no updatedAt)

```
id              String        @id @default(cuid())
workspaceId     String
submissionId    String
revisionNumber  Int           (COUNT of prior reviews + 1; unique per submission)

snapshotTitle         String
snapshotScopeOfWork   String
snapshotJurisdiction  String
snapshotPermitType    PermitType
snapshotProjectType   ProjectType
snapshotReviewContext String?
snapshotArtifacts     String[]  (each element is a JSON-serialized artifact object:
                                 { fileName, mimeType, sizeBytes, documentLabel })

modelVersion   String        (e.g. "claude-sonnet-4-6")
promptVersion  String        (e.g. "v5"; bumped when the prompt changes)
rawPayload     Json          (verbatim AI response for auditability and debugging)

verdict        ReviewVerdict
summary        String
missingDocs    String[]

createdAt      DateTime      @default(now())
```

Reviews are immutable. Once created, they are never updated. The snapshot fields capture the full submission state at review time so that the compare page and report page always reflect what the AI actually saw, even if the submission is later edited.

### ReviewIssue

```
id            String        @id @default(cuid())
reviewId      String
severity      IssueSeverity
category      String        (e.g. "Setbacks", "Egress", "Energy Compliance")
description   String
codeReference String?       (best-effort; may be null)
```

### Artifact

```
id            String   @id @default(cuid())
workspaceId   String
submissionId  String
fileName      String
mimeType      String
sizeBytes     Int
storagePath   String   (path reference to Supabase Storage)
documentLabel String?  (user-assigned label matching a profile required-document string)
createdAt     DateTime @default(now())
```

### SubmissionTemplate

```
id            String      @id @default(cuid())
workspaceId   String
name          String
permitType    PermitType
projectType   ProjectType
address       String
jurisdiction  String
scopeOfWork   String
reviewContext String?
createdAt     DateTime    @default(now())
updatedAt     DateTime    @updatedAt
```

### Enums

```
SubmissionStatus   DRAFT | REVIEWED | NEEDS_REVISION

PermitType         BUILDING | ELECTRICAL | PLUMBING | MECHANICAL | ZONING | GRADING

ProjectType        REMODEL | ADDITION | ADU | NEW_CONSTRUCTION | DECK_PATIO |
                   FENCE_WALL | POOL | DEMOLITION | OTHER

ReviewVerdict      LIKELY_APPROVE | CONDITIONAL | LIKELY_REJECT

IssueSeverity      CRITICAL | MAJOR | MINOR
```

## Key Routes

- `/login`: email/password sign in
- `/signup`: account creation
- `/dashboard`: stat cards, needs-attention table, recent submissions and reviews
- `/submissions`: paginated submission list with status, permit type, review count
- `/submissions/new`: create submission form with optional template pre-fill
- `/submissions/[id]`: submission detail (scope, artifacts, full review history, issue list)
- `/submissions/[id]/edit`: edit submission scope, permit type, project type, and reviewer context
- `/submissions/[id]/compare`: side-by-side diff of two review revisions
- `/submissions/[id]/report`: formatted printable report for one review revision
- `/submissions/templates`: template list with search and sort

## Key Files

- `middleware.ts`: session validation on all protected routes
- `lib/db.ts`: Prisma client singleton
- `lib/bootstrap.ts`: idempotent workspace creation on first login
- `lib/workspace.ts`: `getWorkspaceId(userId)` helper
- `lib/supabase/server.ts`: Supabase Auth server-side client
- `lib/supabase/client.ts`: Supabase Auth browser client
- `lib/actions/submission.ts`: server actions for create and update submission
- `lib/actions/artifact.ts`: server actions for upload and delete artifact
- `lib/actions/review.ts`: server action to trigger AI review and persist results
- `lib/actions/template.ts`: server actions for create, update, and delete template
- `lib/ai/reviewer.ts`: Claude API call, prompt builders, JSON parsing
- `lib/ai/review-profiles.ts`: permit-type-specific review profiles
- `lib/ai/document-coverage.ts`: coverage computation and missing-doc canonicalization
- `lib/ai/review-delta.ts`: revision comparison and delta computation
- `prisma/schema.prisma`: full data model
- `prisma/seed.ts`: demo data seed script (`npm run db:seed`)

## AI Review Pipeline

### 1. Input assembly

`lib/actions/review.ts` reads the target `Submission` row including the full artifact list (fileName, mimeType, sizeBytes, documentLabel). These are passed to `runReview()` in `lib/ai/reviewer.ts`.

### 2. Review profile selection

`selectProfile(permitType, projectType)` in `lib/ai/review-profiles.ts` returns one of eight profiles:

- `building-adu`, `building-new-construction`, `building-remodel-addition` (BUILDING permit, by project type)
- `electrical`, `plumbing`, `mechanical`, `zoning`, `grading` (by permit type)
- `generic` (fallback for BUILDING + unrecognized project type)

Each profile contains:
- `displayName`: human-readable label injected into the system prompt
- `requiredDocuments[]`: ordered list of expected document labels for this permit type
- `focusAreas[]`: key review concerns surfaced in the prompt
- `reviewerGuidance`: permit-type-specific instruction appended to the system prompt

Profiles drive both the document coverage computation and the system prompt. Using profiles instead of a single generic prompt improves review accuracy by giving the model jurisdiction- and permit-type-appropriate instructions.

### 3. Document coverage computation

`computeCoverage(profile.requiredDocuments, artifacts)` in `lib/ai/document-coverage.ts` classifies each required document into one of four buckets:

- **covered**: at least one artifact has a `documentLabel` that exactly matches the required-document string
- **likelyCovered**: implied by a confirmed bundle label (e.g., "Full architectural plan set" implies individual plan sheets)
- **uncovered**: no direct label match and no bundle implication
- **unlabeled**: artifacts present but without a document label

The output is passed to the prompt builder so the AI knows exactly what documentation is confirmed, implied, or missing before it starts its review.

### 4. Prompt construction

`buildSystemPrompt()` produces a system prompt that:
- Sets the model's role as a residential plan checker for the given jurisdiction and permit type
- Injects the review profile's display name, focus areas, and reviewer guidance
- Provides the required JSON response schema with verdict, summary, missingDocs, and issues
- Defines severity levels and the verdict logic rules (LIKELY_REJECT requires at least one CRITICAL issue, CONDITIONAL requires at least one MAJOR with no CRITICAL, LIKELY_APPROVE requires neither)
- Instructs the model not to list confirmed or likely-covered documents in missingDocs

`buildUserMessage()` produces the user turn with:
- Project title, address, jurisdiction, permit type, project type
- Full scope of work
- Optional reviewer context from the applicant
- The full document coverage manifest (confirmed, likely covered, not confirmed, unlabeled)

### 5. Claude API call

```
model:       REVIEW_MODEL env var (defaults to "claude-sonnet-4-6")
max_tokens:  2048
temperature: 0
```

Temperature 0 is used for structured output to minimize non-determinism in the JSON response. The model is instructed to return a single JSON object with no markdown, no code fences, and no commentary.

### 6. Response parsing and validation

`validateAndNormalize()` checks:
- `verdict` is one of the three valid ReviewVerdict strings
- `summary` is a non-empty string
- Each issue has a valid `severity` value
- Invalid issues are silently dropped; `missingDocs` items are filtered to strings

`stripFence()` handles the case where the model wraps its response in a markdown code fence despite the instruction not to.

If parsing fails, the server action redirects to the submission detail page with `?review_error=1` so the UI can surface an error without creating a broken review record.

### 7. Missing document canonicalization

`canonicalizeMissingDocs(docs, profile.requiredDocuments)` normalizes each AI-emitted missing-document string back to the verbatim label from the review profile. Normalization uses exact string matching (case-insensitive, whitespace-collapsed) followed by a base-label match that strips parenthetical suffixes.

This step prevents the compare/delta engine from reporting false "resolved" or "newly missing" items caused by the model rephrasing the same document requirement across revision cycles.

### 8. Persistence

All write operations happen in a single `db.$transaction()`:
- One `Review` row is created with all snapshot fields populated and `rawPayload` set to the verbatim AI response
- `ReviewIssue` rows are created as nested `issues: { create: [...] }` within the Review create
- `submission.status` is updated in the same transaction (see step 9)

Snapshot fields capture the submission state at review time. If the user later edits their submission, prior review records remain accurate to what the AI actually evaluated.

`rawPayload` stores the raw AI JSON verbatim. It is not displayed in the UI but is available for debugging, auditing, and potential future replay without re-calling the API.

### 9. Status update

In the same transaction as review creation:

- If any ReviewIssue has `severity: "CRITICAL"`: `submission.status = "NEEDS_REVISION"`
- Otherwise: `submission.status = "REVIEWED"`

No intermediate status (such as a pending state) exists. The submission moves directly from its prior status to one of these two outcomes when the transaction commits.

### 10. Mock reviewer mode

Setting `MOCK_REVIEWER=true` in the environment causes `runReview()` to return a hardcoded `LIKELY_REJECT` result with two issues and two missing documents, bypassing the Anthropic API entirely. This is useful for local development and demo recordings where review latency or API cost matters.

## Compare and Delta Engine

`lib/ai/review-delta.ts` exports `computeDelta(latest, previous)` which takes two review snapshots (issues and missingDocs) and returns a `ReviewDelta`:

```typescript
type ReviewDelta = {
  resolved:     DeltaIssue[];  // in previous, not in latest
  persisted:    DeltaIssue[];  // in both
  introduced:   DeltaIssue[];  // in latest, not in previous
  docsResolved: string[];      // missing in previous, resolved in latest
  docsAdded:    string[];      // new in latest, not in previous
  hasChanges:   boolean;
};
```

**Issue matching** uses a two-tier approach to tolerate AI paraphrasing across revisions:

1. **Tier 1:** Same topic key (derived from category) plus a matching normalized code reference. Fires when both revisions cite the same code section for the same category.
2. **Tier 2:** Same topic key plus description token overlap. At least 4 of the first 10 significant tokens of one description must appear in the other, after stopword removal.

**Category families** (`CATEGORY_FAMILIES`) map related category phrasings to a shared key. For example, "Structural Documentation" and "Structural Calculations" both normalize to the `structural` family. This prevents the model's category wording variations from producing false churn.

**Document family matching** (`FAMILY_PATTERNS`) does the equivalent for missing-doc strings: "Site plan drawn to scale showing property lines" and "Dimensioned site plan" both map to the `site-plan` family. The longest (most specific) string in each family is used as the representative when building the delta output.

The compare page uses `computeDelta()` to determine which section (resolved, persisted, introduced) to place each issue in, and renders the results with color-coded severity badges.

## Engineering Decisions

- **Structured JSON output at temperature 0:** enables reliable parsing into typed issue rows and avoids unstructured prose that cannot be displayed in the UI.
- **Review profiles (8 permit-type-specific):** a single generic prompt produces lower-quality results; profiles give the model jurisdiction-appropriate focus areas, required-document lists, and reviewer guidance tailored to the permit type.
- **Snapshot fields on Review:** the full submission state is captured at review time so that reviews are immutable historical records; editing a submission after the fact does not corrupt prior reviews.
- **`rawPayload` on Review:** the verbatim AI JSON is stored for debugging and auditing without re-calling the API; also useful for future replay or analysis.
- **`canonicalizeMissingDocs`:** AI output is normalized against profile required-document labels to prevent false "resolved" deltas caused by the model rephrasing the same document requirement across revisions.
- **Two-tier issue matching:** code reference exact match first, then description token overlap; tolerates AI paraphrasing while keeping unrelated issues distinct.
- **Category families:** related category phrasings are mapped to shared keys to absorb model category drift across revisions without manual synonym tables.
- **Workspace-scoped queries:** every Prisma query filters by `workspaceId`, enforcing data isolation at the application layer; Supabase RLS can be added in a future version without schema changes.
- **Artifact metadata only:** the `storagePath` string and document label are stored, but no OCR or content extraction is performed; artifact metadata is already useful to the AI for document coverage reasoning.
- **Single-user workspace for MVP:** the `WorkspaceMember` join table is already in place; multi-user access requires only new rows and RLS policies.

## Limitations

- **No OCR or document content extraction.** Artifacts are attached as file metadata (name, type, size, label). The AI reviewer reasons about what documents are present based on labels, but cannot read the content of the files.
- **No jurisdiction code database.** Jurisdiction is a free-text field. The AI cites code sections from training knowledge; citations are best-effort and should be verified against current local requirements before use in a real permit submission.
- **Application-layer ownership only.** Supabase RLS is not enabled. The `workspaceId` filter in Prisma queries is the sole access control boundary.
- **Single-user workspace.** The current implementation assumes one user per workspace. The schema and bootstrap logic support adding team members, but no multi-user UI or invitation flow exists yet.
- **No AI retry logic.** If the Anthropic API call fails or returns unparseable JSON, the user sees an error and must re-request the review manually.
- **Permit rules are not authoritative.** Counterparty is a review aid, not a regulatory source. Verdicts and issue flags reflect AI judgment and should be treated accordingly.

## See Also

- [README](../README.md)
- [Product Requirements](PRD.md)
- [Architecture (historical planning document)](ARCHITECTURE.md)
- [Demo Script](DEMO_SCRIPT.md)
