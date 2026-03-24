import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { requestReview } from "@/lib/actions/review";
import type { PermitType, ProjectType, SubmissionStatus, ReviewVerdict, IssueSeverity } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getSubmission(id: string, workspaceId: string) {
  return db.submission.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      title: true,
      address: true,
      jurisdiction: true,
      permitType: true,
      projectType: true,
      scopeOfWork: true,
      reviewContext: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          revisionNumber: true,
          verdict: true,
          summary: true,
          missingDocs: true,
          modelVersion: true,
          createdAt: true,
          issues: {
            orderBy: { severity: "asc" },
            select: {
              id: true,
              severity: true,
              category: true,
              description: true,
              codeReference: true,
            },
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  BUILDING: "Building",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  MECHANICAL: "Mechanical (HVAC)",
  ZONING: "Zoning / Land Use",
  GRADING: "Grading / Drainage",
};

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  REMODEL: "Kitchen or Bath Remodel",
  ADDITION: "Room Addition",
  ADU: "ADU",
  NEW_CONSTRUCTION: "New Construction",
  DECK_PATIO: "Deck or Patio",
  FENCE_WALL: "Fence or Retaining Wall",
  POOL: "Pool or Spa",
  DEMOLITION: "Demolition",
  OTHER: "Other",
};

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  REVIEWED: "bg-green-50 text-green-700",
  NEEDS_REVISION: "bg-amber-50 text-amber-700",
};

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Reviewed",
  NEEDS_REVISION: "Needs Revision",
};

const VERDICT_STYLES: Record<ReviewVerdict, string> = {
  LIKELY_APPROVE: "bg-green-50 text-green-700",
  CONDITIONAL: "bg-amber-50 text-amber-700",
  LIKELY_REJECT: "bg-red-50 text-red-700",
};

const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  LIKELY_APPROVE: "Likely Approve",
  CONDITIONAL: "Conditional",
  LIKELY_REJECT: "Likely Reject",
};

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  MAJOR: "bg-amber-50 text-amber-700",
  MINOR: "bg-zinc-100 text-zinc-600",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-3 border-b border-zinc-100 last:border-0">
      <span className="w-36 shrink-0 text-sm text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-900">{children}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-medium text-zinc-700">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

type ReviewRecord = NonNullable<Awaited<ReturnType<typeof getSubmission>>>["reviews"][number];

function ReviewCard({ review }: { review: ReviewRecord }) {
  const criticalCount = review.issues.filter((i) => i.severity === "CRITICAL").length;
  const majorCount = review.issues.filter((i) => i.severity === "MAJOR").length;
  const minorCount = review.issues.filter((i) => i.severity === "MINOR").length;

  return (
    <div className="py-5 border-b border-zinc-100 last:border-0">
      {/* Review header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-medium text-zinc-400">
          Revision {review.revisionNumber}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[review.verdict]}`}
        >
          {VERDICT_LABELS[review.verdict]}
        </span>
        <span className="ml-auto text-xs text-zinc-400">
          {formatDate(review.createdAt)}
        </span>
      </div>

      {/* Summary */}
      <p className="mb-4 text-sm text-zinc-700">{review.summary}</p>

      {/* Issue counts */}
      {review.issues.length > 0 && (
        <div className="mb-4 flex gap-3">
          {criticalCount > 0 && (
            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              {criticalCount} critical
            </span>
          )}
          {majorCount > 0 && (
            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {majorCount} major
            </span>
          )}
          {minorCount > 0 && (
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {minorCount} minor
            </span>
          )}
        </div>
      )}

      {/* Issues */}
      {review.issues.length > 0 && (
        <div className="mb-4 space-y-2">
          {review.issues.map((issue) => (
            <div
              key={issue.id}
              className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[issue.severity]}`}
                >
                  {issue.severity.charAt(0) + issue.severity.slice(1).toLowerCase()}
                </span>
                <span className="text-xs font-medium text-zinc-700">
                  {issue.category}
                </span>
                {issue.codeReference && (
                  <span className="ml-auto text-xs text-zinc-400">
                    {issue.codeReference}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-600">{issue.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Missing docs */}
      {review.missingDocs.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Missing Documentation
          </p>
          <ul className="space-y-1">
            {review.missingDocs.map((doc, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="mt-1 text-zinc-300">–</span>
                {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-300">Model: {review.modelVersion}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

function NotFound() {
  return (
    <div className="p-8">
      <Link
        href="/submissions"
        className="text-sm text-zinc-400 hover:text-zinc-600"
      >
        ← Submissions
      </Link>
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-sm font-medium text-zinc-900">Submission not found</p>
        <p className="mt-1 text-sm text-zinc-500">
          This submission doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/submissions"
          className="mt-4 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
        >
          View all submissions
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review_error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { review_error } = await searchParams;
  const workspaceId = await getWorkspaceId(user.id);
  const submission = await getSubmission(id, workspaceId);

  if (!submission) return <NotFound />;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/submissions"
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Submissions
        </Link>
        <div className="mt-2 flex items-center gap-2.5">
          <h1 className="text-lg font-semibold text-zinc-900">
            {submission.title}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[submission.status]}`}
          >
            {STATUS_LABELS[submission.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">{submission.address}</p>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl">
        {/* Details */}
        <Section title="Details">
          <DetailRow label="Jurisdiction">{submission.jurisdiction}</DetailRow>
          <DetailRow label="Permit Type">
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {PERMIT_TYPE_LABELS[submission.permitType]}
            </span>
          </DetailRow>
          <DetailRow label="Project Type">
            {PROJECT_TYPE_LABELS[submission.projectType]}
          </DetailRow>
          <DetailRow label="Scope of Work">
            <span className="whitespace-pre-wrap">{submission.scopeOfWork}</span>
          </DetailRow>
          {submission.reviewContext && (
            <DetailRow label="Review Context">
              <span className="whitespace-pre-wrap">{submission.reviewContext}</span>
            </DetailRow>
          )}
          <DetailRow label="Created">{formatDate(submission.createdAt)}</DetailRow>
          <DetailRow label="Updated">{formatDate(submission.updatedAt)}</DetailRow>
        </Section>

        {/* Reviews */}
        <Section title="Reviews">
          <div className="py-4 border-b border-zinc-100">
            {review_error && (
              <p className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                Review failed — check server logs for details.
              </p>
            )}
            <form action={requestReview}>
              <input type="hidden" name="submissionId" value={submission.id} />
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
              >
                Request Review
              </button>
            </form>
          </div>

          {submission.reviews.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-400">No reviews yet.</p>
              <p className="mt-1 text-xs text-zinc-300">
                Request a review above to get AI feedback on your submission.
              </p>
            </div>
          ) : (
            submission.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          )}
        </Section>
      </div>
    </div>
  );
}
