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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from: rawFrom, to: rawTo } = await searchParams;

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
      reviews: {
        orderBy: { revisionNumber: "desc" },
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

  // Build an ordered list of revision numbers (desc) and a lookup map.
  const sortedRevNums = submission.reviews.map((r) => r.revisionNumber);
  const revNumSet = new Set(sortedRevNums);
  const reviewByRevNum = new Map(
    submission.reviews.map((r) => [r.revisionNumber, r])
  );

  // Parse and validate searchParams — per-param fallbacks.
  const parsedTo = parseInt(rawTo ?? "", 10);
  const parsedFrom = parseInt(rawFrom ?? "", 10);

  const toRevNum = revNumSet.has(parsedTo) ? parsedTo : sortedRevNums[0];
  const fromRevNum = revNumSet.has(parsedFrom) ? parsedFrom : sortedRevNums[1];

  const toReview   = reviewByRevNum.get(toRevNum)!;
  const fromReview = reviewByRevNum.get(fromRevNum)!;

  const sameRevision = fromRevNum === toRevNum;

  // computeDelta(latest, previous) — "to" is the revision being compared to,
  // "from" is the baseline. "to" is newer unless the user picked an unusual pair.
  const delta = sameRevision ? null : computeDelta(toReview, fromReview);
  const resolvedSet = delta ? new Set(delta.docsResolved) : new Set<string>();
  const docsPersisted = sameRevision
    ? []
    : toReview.missingDocs.filter((d) => !resolvedSet.has(d));

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
        {/* Revision selector */}
        <form method="GET" className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              From
            </label>
            <select
              id="from"
              name="from"
              defaultValue={fromRevNum}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              {sortedRevNums.map((n) => (
                <option key={n} value={n}>
                  Revision {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              To
            </label>
            <select
              id="to"
              name="to"
              defaultValue={toRevNum}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              {sortedRevNums.map((n) => (
                <option key={n} value={n}>
                  Revision {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Apply
          </button>
        </form>

        {/* Revision header cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* From */}
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Revision {fromRevNum}
            </p>
            <p className="text-xs text-zinc-400">{formatDate(fromReview.createdAt)}</p>
            <span
              className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[fromReview.verdict]}`}
            >
              {VERDICT_LABELS[fromReview.verdict]}
            </span>
          </div>

          {/* To */}
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Revision {toRevNum}
            </p>
            <p className="text-xs text-zinc-400">{formatDate(toReview.createdAt)}</p>
            <span
              className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[toReview.verdict]}`}
            >
              {VERDICT_LABELS[toReview.verdict]}
            </span>
          </div>
        </div>

        {sameRevision ? (
          <p className="text-sm text-zinc-400">
            Select two different revisions to compare.
          </p>
        ) : (
          <>
            {/* Delta — issues */}
            <div className="rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-5 py-3.5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Issue Changes
                </h2>
              </div>
              <div className="px-5 py-4 space-y-5">
                {!delta!.hasChanges && delta!.docsResolved.length === 0 && delta!.docsAdded.length === 0 ? (
                  <p className="text-sm text-zinc-400">No changes between these two revisions.</p>
                ) : (
                  <>
                    {/* Resolved issues */}
                    {delta!.resolved.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-green-700">
                          Resolved ({delta!.resolved.length})
                        </p>
                        <div className="space-y-2">
                          {delta!.resolved.map((issue, i) => (
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
                    {delta!.introduced.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-red-700">
                          Introduced ({delta!.introduced.length})
                        </p>
                        <div className="space-y-2">
                          {delta!.introduced.map((issue, i) => (
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

                    {/* Still present — shown only alongside other changes */}
                    {delta!.persisted.length > 0 && (delta!.resolved.length > 0 || delta!.introduced.length > 0) && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-zinc-400">
                          Still present ({delta!.persisted.length})
                        </p>
                        <div className="space-y-2">
                          {delta!.persisted.map((issue, i) => (
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
            {(delta!.docsResolved.length > 0 || delta!.docsAdded.length > 0 || docsPersisted.length > 0) && (
              <div className="rounded-lg border border-zinc-200 bg-white">
                <div className="border-b border-zinc-100 px-5 py-3.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Missing Document Changes
                  </h2>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {delta!.docsResolved.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-green-700">
                        Resolved ({delta!.docsResolved.length})
                      </p>
                      <ul className="space-y-1">
                        {delta!.docsResolved.map((doc, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                            <span className="mt-0.5 shrink-0 font-semibold text-green-600">✓</span>
                            {doc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {delta!.docsAdded.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-amber-700">
                        Newly flagged ({delta!.docsAdded.length})
                      </p>
                      <ul className="space-y-1">
                        {delta!.docsAdded.map((doc, i) => (
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
                    Revision {fromRevNum}
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-700">{fromReview.summary}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="mb-1.5 text-xs font-semibold text-zinc-400">
                    Revision {toRevNum}
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-700">{toReview.summary}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
