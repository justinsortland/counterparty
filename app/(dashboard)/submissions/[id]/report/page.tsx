import { cache } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { selectProfile } from "@/lib/ai/review-profiles";
import { computeCoverage } from "@/lib/ai/document-coverage";
import type { ArtifactForCoverage } from "@/lib/ai/document-coverage";
import type { PermitType, ProjectType, ReviewVerdict, IssueSeverity } from "@prisma/client";
import { PrintButton } from "./_components/print-button";

// ---------------------------------------------------------------------------
// Labels
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

const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  CRITICAL: "Critical",
  MAJOR: "Major",
  MINOR: "Minor",
};

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  MAJOR: "bg-amber-50 text-amber-700",
  MINOR: "bg-zinc-100 text-zinc-600",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Data — cached so generateMetadata and the page share one DB round-trip
// ---------------------------------------------------------------------------

const getReportData = cache(async (id: string) => {
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
      address: true,
      jurisdiction: true,
      permitType: true,
      projectType: true,
      scopeOfWork: true,
      // Latest review only — explicit descending order by revisionNumber
      reviews: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        select: {
          revisionNumber: true,
          verdict: true,
          summary: true,
          missingDocs: true,
          snapshotArtifacts: true,
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

// ---------------------------------------------------------------------------
// Metadata — sets <title> which becomes the browser's default PDF filename
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const submission = await getReportData(id);
  const review = submission?.reviews[0];
  if (!submission || !review) return { title: "Review Report" };

  const reviewDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(review.createdAt);

  return {
    title: `${submission.title} \u2013 Revision ${review.revisionNumber} \u2013 ${reviewDate}`,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const submission = await getReportData(id);
  if (!submission) redirect("/submissions");

  const latestReview = submission.reviews[0];
  if (!latestReview) redirect(`/submissions/${id}`);

  // Compute coverage from the review's snapshot artifacts so it is
  // time-consistent with the verdict and issues — not affected by any
  // documents uploaded or removed after this review ran.
  const snapshotArtifacts: ArtifactForCoverage[] = latestReview.snapshotArtifacts
    .map((s) => { try { return JSON.parse(s) as ArtifactForCoverage; } catch { return null; } })
    .filter((a): a is ArtifactForCoverage => a !== null);

  const profile = selectProfile(submission.permitType, submission.projectType);
  const coverage = computeCoverage(profile.requiredDocuments, snapshotArtifacts);

  const criticalIssues = latestReview.issues.filter((i) => i.severity === "CRITICAL");
  const majorIssues   = latestReview.issues.filter((i) => i.severity === "MAJOR");
  const minorIssues   = latestReview.issues.filter((i) => i.severity === "MINOR");

  const issueGroups = [
    { severity: "CRITICAL" as IssueSeverity, items: criticalIssues },
    { severity: "MAJOR"    as IssueSeverity, items: majorIssues },
    { severity: "MINOR"    as IssueSeverity, items: minorIssues },
  ].filter((g) => g.items.length > 0);

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

      {/* Report content */}
      <div className="mx-auto max-w-2xl px-8 py-10 print:px-0 print:py-0">
        {/* Report header */}
        <div className="mb-8 border-b border-zinc-200 pb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Permit Review Report
          </p>
          <h1 className="text-2xl font-bold text-zinc-900">{submission.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
            <span>{submission.address}</span>
            <span>{submission.jurisdiction}</span>
            <span>{PERMIT_TYPE_LABELS[submission.permitType]}</span>
            <span>{PROJECT_TYPE_LABELS[submission.projectType]}</span>
          </div>
        </div>

        {/* Review metadata + verdict */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Revision {latestReview.revisionNumber}
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">{formatDate(latestReview.createdAt)}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${VERDICT_STYLES[latestReview.verdict]}`}
          >
            {VERDICT_LABELS[latestReview.verdict]}
          </span>
        </div>

        {/* Summary */}
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Summary
          </h2>
          <p className="text-sm leading-relaxed text-zinc-700">{latestReview.summary}</p>
        </section>

        {/* Issues */}
        {issueGroups.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Issues ({latestReview.issues.length})
            </h2>
            <div className="space-y-4">
              {issueGroups.map(({ severity, items }) => (
                <div key={severity}>
                  <p className="mb-1.5 text-xs font-semibold text-zinc-500">
                    {SEVERITY_LABELS[severity]}
                  </p>
                  <div className="space-y-2">
                    {items.map((issue, i) => (
                      <div
                        key={i}
                        className="break-inside-avoid rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}
                          >
                            {SEVERITY_LABELS[severity]}
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
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Missing documents */}
        {latestReview.missingDocs.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Missing Documentation
            </h2>
            <ul className="space-y-1">
              {latestReview.missingDocs.map((doc, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                  <span className="mt-0.5 shrink-0 text-zinc-300">–</span>
                  {doc}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Document coverage — computed from snapshot, time-consistent with this review */}
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Document Coverage at Review Time
          </h2>
          {snapshotArtifacts.length === 0 ? (
            <p className="text-sm text-zinc-400">No documents were attached at the time of this review.</p>
          ) : (
            <ul className="space-y-1.5">
              {profile.requiredDocuments.map((doc, i) => {
                const isCovered = coverage.covered.includes(doc);
                const isLikely = !isCovered && coverage.likelyCovered.some((lc) => lc.docLabel === doc);
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 text-xs font-semibold ${
                        isCovered ? "text-green-600" : isLikely ? "text-amber-500" : "text-zinc-300"
                      }`}
                    >
                      {isCovered ? "✓" : isLikely ? "~" : "–"}
                    </span>
                    <span className={isCovered ? "text-zinc-700" : "text-zinc-500"}>{doc}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Footer */}
        <div className="border-t border-zinc-100 pt-4 text-xs text-zinc-300">
          Generated by Counterparty · {formatDate(new Date())}
        </div>
      </div>
    </div>
  );
}
