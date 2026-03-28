import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { requestReview } from "@/lib/actions/review";
import { uploadArtifact, deleteArtifact, labelArtifact } from "@/lib/actions/artifact";
import { buttonVariants } from "@/lib/button-variants";
import { UploadButton } from "./_components/upload-button";
import { LabelSelect } from "./_components/label-select";
import { selectProfile } from "@/lib/ai/review-profiles";
import { computeCoverage } from "@/lib/ai/document-coverage";
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
      artifacts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          storagePath: true,
          documentLabel: true,
          createdAt: true,
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          revisionNumber: true,
          verdict: true,
          summary: true,
          missingDocs: true,
          snapshotArtifacts: true,
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

const VERDICT_BORDER: Record<ReviewVerdict, string> = {
  LIKELY_APPROVE: "border-l-green-300",
  CONDITIONAL: "border-l-amber-300",
  LIKELY_REJECT: "border-l-red-300",
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseSnapshotArtifact(
  s: string
): { fileName: string; mimeType: string; sizeBytes: number; documentLabel?: string | null } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
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
      <div className="border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

type ReviewRecord = NonNullable<
  Awaited<ReturnType<typeof getSubmission>>
>["reviews"][number];

function IssueSummaryChips({
  issues,
}: {
  issues: ReviewRecord["issues"];
}) {
  const criticalCount = issues.filter((i) => i.severity === "CRITICAL").length;
  const majorCount = issues.filter((i) => i.severity === "MAJOR").length;
  const minorCount = issues.filter((i) => i.severity === "MINOR").length;

  if (issues.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
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
  );
}

function ReviewBody({ review }: { review: ReviewRecord }) {
  const parsedArtifacts = review.snapshotArtifacts
    .map(parseSnapshotArtifact)
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return (
    <>
      {/* Summary */}
      <p className="mb-4 text-sm text-zinc-700">{review.summary}</p>

      {/* Issue counts */}
      {review.issues.length > 0 && (
        <div className="mb-4">
          <IssueSummaryChips issues={review.issues} />
        </div>
      )}

      {/* Individual issues */}
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
        <div className="mb-4">
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

      {/* Artifact snapshot */}
      <div className="pt-3 border-t border-zinc-100">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Documents at review time
        </p>
        {parsedArtifacts.length > 0 ? (
          <ul className="space-y-0.5">
            {parsedArtifacts.map((a, i) => (
              <li key={i} className="text-xs text-zinc-500">
                {a.fileName}
                {a.documentLabel && (
                  <span className="ml-1.5 text-zinc-400">[{a.documentLabel}]</span>
                )}
                <span className="ml-1.5 text-zinc-300">{formatBytes(a.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-400">None attached</p>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-300">Model: {review.modelVersion}</p>
    </>
  );
}

function ReviewCard({
  review,
  isLatest,
}: {
  review: ReviewRecord;
  isLatest: boolean;
}) {
  const header = (
    <div className={`border-l-2 pl-3 ${VERDICT_BORDER[review.verdict]}`}>
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold text-zinc-500">
          Revision {review.revisionNumber}
        </span>
        {isLatest && (
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
            Latest
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[review.verdict]}`}
        >
          {VERDICT_LABELS[review.verdict]}
        </span>
        <span className="ml-auto text-xs text-zinc-400">
          {formatDate(review.createdAt)}
        </span>
      </div>
    </div>
  );

  if (isLatest) {
    return (
      <div className="py-5 border-b border-zinc-100 last:border-0">
        <div className="mb-4">{header}</div>
        <ReviewBody review={review} />
      </div>
    );
  }

  // Older reviews: collapsed by default
  return (
    <details className="group border-b border-zinc-100 last:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4">
        <div className={`flex-1 border-l-2 pl-3 ${VERDICT_BORDER[review.verdict]}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-zinc-500">
              Revision {review.revisionNumber}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[review.verdict]}`}
            >
              {VERDICT_LABELS[review.verdict]}
            </span>
            <span className="text-xs text-zinc-400">{formatDate(review.createdAt)}</span>
            <IssueSummaryChips issues={review.issues} />
          </div>
        </div>
        <span className="inline-block shrink-0 text-sm text-zinc-300 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="pb-5">
        <ReviewBody review={review} />
      </div>
    </details>
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
  searchParams: Promise<{ review_error?: string; upload_error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { review_error, upload_error } = await searchParams;
  const workspaceId = await getWorkspaceId(user.id);
  const submission = await getSubmission(id, workspaceId);

  if (!submission) return <NotFound />;

  const profile = selectProfile(submission.permitType, submission.projectType);
  const coverage = computeCoverage(profile.requiredDocuments, submission.artifacts);

  // Generate signed download URLs for artifacts (1-hour expiry)
  const adminClient = createAdminClient();
  const artifactsWithUrls = await Promise.all(
    submission.artifacts.map(async (a) => {
      const { data } = await adminClient.storage
        .from("artifacts")
        .createSignedUrl(a.storagePath, 3600);
      return { ...a, signedUrl: data?.signedUrl ?? null };
    })
  );

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
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
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
          <Link
            href={`/submissions/${submission.id}/edit`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-6 max-w-2xl">
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

        {/* Expected Documents */}
        <Section title="Expected Documents">
          <div className="py-4">
            <p className="mb-3 text-xs text-zinc-400">{profile.displayName}</p>
            <ul className="mb-4 space-y-1.5">
              {profile.requiredDocuments.map((doc, i) => {
                const isCovered = coverage.covered.includes(doc);
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 text-xs font-semibold ${
                        isCovered ? "text-green-600" : "text-zinc-300"
                      }`}
                    >
                      {isCovered ? "✓" : "–"}
                    </span>
                    <span className={isCovered ? "text-zinc-700" : "text-zinc-500"}>
                      {doc}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {profile.focusAreas.map((area, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                >
                  {area}
                </span>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              Typical requirements — confirm with your jurisdiction. Mark
              uploaded files with a document type to track coverage.
            </p>
          </div>
        </Section>

        {/* Attachments */}
        <Section title="Attachments">
          <div className="py-4 border-b border-zinc-100">
            {upload_error && (
              <p className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                Upload failed — check that the file is valid and try again.
              </p>
            )}
            <form action={uploadArtifact} className="flex items-center gap-3">
              <input type="hidden" name="submissionId" value={submission.id} />
              <input
                type="file"
                name="file"
                className="text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
              />
              <UploadButton />
            </form>
          </div>

          {artifactsWithUrls.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-400">No files attached yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {artifactsWithUrls.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    {a.signedUrl ? (
                      <a
                        href={a.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-zinc-900 hover:text-zinc-600"
                      >
                        {a.fileName}
                      </a>
                    ) : (
                      <span className="truncate text-sm font-medium text-zinc-900">
                        {a.fileName}
                      </span>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {formatBytes(a.sizeBytes)}
                    </p>
                  </div>
                  <form action={labelArtifact} className="shrink-0">
                    <input type="hidden" name="artifactId" value={a.id} />
                    <input type="hidden" name="submissionId" value={submission.id} />
                    <LabelSelect
                      name="documentLabel"
                      defaultValue={a.documentLabel ?? ""}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-zinc-400 max-w-52"
                    >
                      <option value="">— unlabeled —</option>
                      {profile.requiredDocuments.map((doc) => (
                        <option key={doc} value={doc}>
                          {doc}
                        </option>
                      ))}
                      <option value="Other">Other</option>
                    </LabelSelect>
                  </form>
                  <form action={deleteArtifact} className="shrink-0 pt-0.5">
                    <input type="hidden" name="artifactId" value={a.id} />
                    <input type="hidden" name="submissionId" value={submission.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
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
            <>
              <ReviewCard review={submission.reviews[0]} isLatest />
              {submission.reviews.slice(1).map((review) => (
                <ReviewCard key={review.id} review={review} isLatest={false} />
              ))}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
