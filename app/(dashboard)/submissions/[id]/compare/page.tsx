import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { computeDelta } from "@/lib/ai/review-delta";
import type { ReviewVerdict, IssueSeverity } from "@prisma/client";

// ---------------------------------------------------------------------------
// Labels / styles
// ---------------------------------------------------------------------------

const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  LIKELY_APPROVE: "Likely Approve",
  CONDITIONAL: "Conditional",
  LIKELY_REJECT: "Likely Reject",
};

const VERDICT_STYLES: Record<ReviewVerdict, string> = {
  LIKELY_APPROVE: "bg-green-50 text-green-700",
  CONDITIONAL: "bg-amber-50 text-amber-700",
  LIKELY_REJECT: "bg-red-50 text-red-700",
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
// Page
// ---------------------------------------------------------------------------

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const submission = await db.submission.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      title: true,
      // Fetch the two most recent reviews — explicit descending order so
      // reviews[0] is always the latest and reviews[1] is always the previous.
      reviews: {
        orderBy: { revisionNumber: "desc" },
        take: 2,
        select: {
          revisionNumber: true,
          verdict: true,
          summary: true,
          missingDocs: true,
          createdAt: true,
          issues: {
            orderBy: { severity: "asc" },
            select: {
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

  if (!submission) redirect("/submissions");
  if (submission.reviews.length < 2) redirect(`/submissions/${id}`);

  const latestReview   = submission.reviews[0];
  const previousReview = submission.reviews[1];

  // computeDelta(latest, previous) — first arg is the current state, second is
  // the prior state. Matches the function signature and the detail page usage.
  const delta = computeDelta(latestReview, previousReview);

  // Still-missing docs: present in the latest review and not resolved.
  const resolvedSet = new Set(delta.docsResolved);
  const docsPersisted = latestReview.missingDocs.filter((d) => !resolvedSet.has(d));

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href={`/submissions/${id}`}
        className="text-sm text-zinc-400 hover:text-zinc-600"
      >
        ← Back to submission
      </Link>

      {/* Page title */}
      <div className="mt-2 mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Compare Revisions</h1>
        <p className="mt-0.5 text-sm text-zinc-400">{submission.title}</p>
      </div>

      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Revision header cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Previous */}
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Previous review
            </p>
            <p className="text-sm font-medium text-zinc-700">
              Revision {previousReview.revisionNumber}
            </p>
            <p className="text-xs text-zinc-400">{formatDate(previousReview.createdAt)}</p>
            <span
              className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[previousReview.verdict]}`}
            >
              {VERDICT_LABELS[previousReview.verdict]}
            </span>
          </div>

          {/* Latest */}
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Latest review
            </p>
            <p className="text-sm font-medium text-zinc-700">
              Revision {latestReview.revisionNumber}
            </p>
            <p className="text-xs text-zinc-400">{formatDate(latestReview.createdAt)}</p>
            <span
              className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[latestReview.verdict]}`}
            >
              {VERDICT_LABELS[latestReview.verdict]}
            </span>
          </div>
        </div>

        {/* Delta — issues */}
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-5 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Issue Changes
            </h2>
          </div>
          <div className="px-5 py-4 space-y-5">
            {!delta.hasChanges && delta.docsResolved.length === 0 && delta.docsAdded.length === 0 ? (
              <p className="text-sm text-zinc-400">No changes between these two reviews.</p>
            ) : (
              <>
                {/* Resolved issues */}
                {delta.resolved.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-green-700">
                      Resolved ({delta.resolved.length})
                    </p>
                    <div className="space-y-2">
                      {delta.resolved.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 shrink-0 font-semibold text-green-600">✓</span>
                          <span>
                            <span
                              className={`mr-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[issue.severity]}`}
                            >
                              {issue.severity.charAt(0) + issue.severity.slice(1).toLowerCase()}
                            </span>
                            <span className="font-medium text-zinc-700">{issue.category}</span>
                            {" — "}
                            <span className="text-zinc-600">{issue.description}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Introduced issues */}
                {delta.introduced.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-red-700">
                      Introduced ({delta.introduced.length})
                    </p>
                    <div className="space-y-2">
                      {delta.introduced.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 shrink-0 font-semibold text-red-500">+</span>
                          <span>
                            <span
                              className={`mr-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[issue.severity]}`}
                            >
                              {issue.severity.charAt(0) + issue.severity.slice(1).toLowerCase()}
                            </span>
                            <span className="font-medium text-zinc-700">{issue.category}</span>
                            {" — "}
                            <span className="text-zinc-600">{issue.description}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Still present — shown only alongside other changes to avoid noise */}
                {delta.persisted.length > 0 && (delta.resolved.length > 0 || delta.introduced.length > 0) && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-zinc-400">
                      Still present ({delta.persisted.length})
                    </p>
                    <div className="space-y-2">
                      {delta.persisted.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-500">
                          <span className="mt-0.5 shrink-0">→</span>
                          <span>
                            <span className="font-medium">{issue.category}</span>
                            {" — "}
                            {issue.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Delta — missing documents */}
        {(delta.docsResolved.length > 0 || delta.docsAdded.length > 0 || docsPersisted.length > 0) && (
          <div className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-5 py-3.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Missing Document Changes
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {delta.docsResolved.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-green-700">
                    Resolved ({delta.docsResolved.length})
                  </p>
                  <ul className="space-y-1">
                    {delta.docsResolved.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                        <span className="mt-0.5 shrink-0 font-semibold text-green-600">✓</span>
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {delta.docsAdded.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-amber-700">
                    Newly flagged ({delta.docsAdded.length})
                  </p>
                  <ul className="space-y-1">
                    {delta.docsAdded.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                        <span className="mt-0.5 shrink-0 font-semibold text-amber-500">+</span>
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {docsPersisted.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-zinc-400">
                    Still missing ({docsPersisted.length})
                  </p>
                  <ul className="space-y-1">
                    {docsPersisted.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-500">
                        <span className="mt-0.5 shrink-0">–</span>
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summaries */}
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-5 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Summaries
            </h2>
          </div>
          <div className="divide-y divide-zinc-100">
            <div className="px-5 py-4">
              <p className="mb-1.5 text-xs font-semibold text-zinc-400">
                Previous review — Revision {previousReview.revisionNumber}
              </p>
              <p className="text-sm leading-relaxed text-zinc-700">{previousReview.summary}</p>
            </div>
            <div className="px-5 py-4">
              <p className="mb-1.5 text-xs font-semibold text-zinc-400">
                Latest review — Revision {latestReview.revisionNumber}
              </p>
              <p className="text-sm leading-relaxed text-zinc-700">{latestReview.summary}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
