import { cache } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { computeDelta } from "@/lib/ai/review-delta";
import type { ReviewVerdict, IssueSeverity } from "@prisma/client";
import { PrintButton } from "../report/_components/print-button";

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

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Data — cached so generateMetadata and the page share one DB round-trip
// ---------------------------------------------------------------------------

const getCompareData = cache(async (id: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspaceId = await getWorkspaceId(user.id);

  return db.submission.findFirst({
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
});

// Shared helper: resolve fromRevNum / toRevNum from raw searchParams + reviews.
function resolveRevNums(
  rawFrom: string | undefined,
  rawTo: string | undefined,
  sortedRevNums: number[]
): { fromRevNum: number; toRevNum: number } {
  const revNumSet = new Set(sortedRevNums);
  const parsedTo = parseInt(rawTo ?? "", 10);
  const parsedFrom = parseInt(rawFrom ?? "", 10);
  return {
    toRevNum: revNumSet.has(parsedTo) ? parsedTo : sortedRevNums[0],
    fromRevNum: revNumSet.has(parsedFrom) ? parsedFrom : sortedRevNums[1],
  };
}

// ---------------------------------------------------------------------------
// Metadata — sets <title> used as the browser's default PDF filename
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { from: rawFrom, to: rawTo } = await searchParams;

  const submission = await getCompareData(id);
  if (!submission || submission.reviews.length < 2) return { title: "Compare Revisions" };

  const sortedRevNums = submission.reviews.map((r) => r.revisionNumber);
  const { fromRevNum, toRevNum } = resolveRevNums(rawFrom, rawTo, sortedRevNums);

  return {
    title: `${submission.title} \u2013 Revision ${fromRevNum} vs. Revision ${toRevNum} \u2013 ${formatDateLong(new Date())}`,
  };
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

  const submission = await getCompareData(id);
  if (!submission) redirect("/submissions");
  if (submission.reviews.length < 2) redirect(`/submissions/${id}`);

  // Build an ordered list of revision numbers (desc) and a lookup map.
  const sortedRevNums = submission.reviews.map((r) => r.revisionNumber);
  const reviewByRevNum = new Map(
    submission.reviews.map((r) => [r.revisionNumber, r])
  );

  const { fromRevNum, toRevNum } = resolveRevNums(rawFrom, rawTo, sortedRevNums);

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
    <div className="min-h-screen bg-white">
      {/* Screen-only toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-3 print:hidden">
        <Link
          href={`/submissions/${id}`}
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Back to submission
        </Link>
        <PrintButton />
      </div>

      <div className="px-8 py-8 print:px-0 print:py-0">
        {/* Print-only header */}
        <div className="hidden print:block mb-8 border-b border-zinc-200 pb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Revision Comparison
          </p>
          <h1 className="text-2xl font-bold text-zinc-900">{submission.title}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Revision {fromRevNum} → Revision {toRevNum}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{formatDateLong(new Date())}</p>
        </div>

        {/* Screen-only page title */}
        <div className="mb-6 print:hidden">
          <h1 className="text-lg font-semibold text-zinc-900">Compare Revisions</h1>
          <p className="mt-0.5 text-sm text-zinc-400">{submission.title}</p>
        </div>

        <div className="flex flex-col gap-6 max-w-2xl">
          {/* Revision selector — screen only */}
          <form method="GET" className="flex items-end gap-3 flex-wrap print:hidden">
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

              {/* Print-only footer */}
              <div className="hidden print:block border-t border-zinc-100 pt-4 text-xs text-zinc-300">
                Generated by Counterparty · {formatDateLong(new Date())}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
