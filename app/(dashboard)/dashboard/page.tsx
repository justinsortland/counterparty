import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import type { PermitType, ReviewVerdict, SubmissionStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getDashboardData(workspaceId: string) {
  const [
    activeCount,
    needsRevisionCount,
    openCriticalCount,
    needsAttentionSubmissions,
    recentSubmissions,
    recentReviews,
  ] = await Promise.all([
    // Active = DRAFT + NEEDS_REVISION (excludes REVIEWED)
    db.submission.count({
      where: { workspaceId, status: { in: ["DRAFT", "NEEDS_REVISION"] } },
    }),
    db.submission.count({
      where: { workspaceId, status: "NEEDS_REVISION" },
    }),
    // CRITICAL issues scoped to reviews on submissions currently NEEDS_REVISION.
    // Avoids counting stale issues from submissions that have since been resolved.
    db.reviewIssue.count({
      where: {
        severity: "CRITICAL",
        review: { workspaceId, submission: { status: "NEEDS_REVISION" } },
      },
    }),
    db.submission.findMany({
      where: { workspaceId, status: "NEEDS_REVISION" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        address: true,
        updatedAt: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            verdict: true,
            issues: { select: { severity: true } },
          },
        },
      },
    }),
    db.submission.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        permitType: true,
        status: true,
        updatedAt: true,
        _count: { select: { reviews: true } },
      },
    }),
    db.review.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        revisionNumber: true,
        verdict: true,
        createdAt: true,
        submission: { select: { id: true, title: true } },
        issues: { select: { severity: true } },
      },
    }),
  ]);

  return {
    activeCount,
    needsRevisionCount,
    openCriticalCount,
    needsAttentionSubmissions,
    recentSubmissions,
    recentReviews,
  };
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

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: "amber" | "red";
}) {
  const valueColor =
    alert && value > 0
      ? alert === "red"
        ? "text-red-600"
        : "text-amber-600"
      : "text-zinc-900";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <p className={`text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-0.5 text-sm text-zinc-500">{label}</p>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-medium text-zinc-700">{title}</h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline underline-offset-4"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

const TH =
  "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
const TD = "px-4 py-3 text-sm";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const {
    activeCount,
    needsRevisionCount,
    openCriticalCount,
    needsAttentionSubmissions,
    recentSubmissions,
    recentReviews,
  } = await getDashboardData(workspaceId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Dashboard</h1>
        <Link
          href="/submissions/new"
          className={buttonVariants({ size: "sm" })}
        >
          + New Submission
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="Active submissions" value={activeCount} />
        <StatCard label="Needs revision" value={needsRevisionCount} alert="amber" />
        <StatCard label="Open critical issues" value={openCriticalCount} alert="red" />
      </div>

      {/* Needs Attention — only rendered when there are NEEDS_REVISION submissions */}
      {needsRevisionCount > 0 && (
        <div className="mb-8">
          <SectionHeader
            title="Needs Attention"
            href="/submissions"
            linkLabel="View all"
          />
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className={TH}>Submission</th>
                  <th className={TH}>Last updated</th>
                  <th className={TH}>Latest verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {needsAttentionSubmissions.map((s) => {
                  const latestReview = s.reviews[0];
                  return (
                    <tr
                      key={s.id}
                      className="transition-colors hover:bg-zinc-50"
                    >
                      <td className={TD}>
                        <Link
                          href={`/submissions/${s.id}`}
                          className="font-medium text-zinc-900 hover:text-zinc-600"
                        >
                          {s.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {s.address}
                        </p>
                      </td>
                      <td className={`${TD} text-zinc-400`}>
                        {formatDate(s.updatedAt)}
                      </td>
                      <td className={TD}>
                        {latestReview ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[latestReview.verdict]}`}
                          >
                            {VERDICT_LABELS[latestReview.verdict]}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Submissions */}
      <div className="mb-8">
        <SectionHeader
          title="Recent Submissions"
          href="/submissions"
          linkLabel="View all"
        />
        {recentSubmissions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center">
            <p className="text-sm text-zinc-400">No submissions yet.</p>
            <Link
              href="/submissions/new"
              className="mt-2 inline-block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
            >
              Create your first submission
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className={TH}>Title</th>
                  <th className={TH}>Permit type</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Reviews</th>
                  <th className={TH}>Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {recentSubmissions.map((s) => (
                  <tr
                    key={s.id}
                    className="transition-colors hover:bg-zinc-50"
                  >
                    <td className={TD}>
                      <Link
                        href={`/submissions/${s.id}`}
                        className="font-medium text-zinc-900 hover:text-zinc-600"
                      >
                        {s.title}
                      </Link>
                    </td>
                    <td className={TD}>
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {PERMIT_TYPE_LABELS[s.permitType]}
                      </span>
                    </td>
                    <td className={TD}>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}
                      >
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className={`${TD} text-zinc-500`}>
                      {s._count.reviews === 0 ? (
                        <span className="text-zinc-300">No reviews</span>
                      ) : (
                        `${s._count.reviews} ${s._count.reviews === 1 ? "review" : "reviews"}`
                      )}
                    </td>
                    <td className={`${TD} text-zinc-400`}>
                      {formatDate(s.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Reviews */}
      <div>
        <SectionHeader title="Recent Reviews" />
        {recentReviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center">
            <p className="text-sm text-zinc-400">No reviews yet.</p>
            <p className="mt-1 text-xs text-zinc-300">
              Request a review from any submission to see results here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className={TH}>Submission</th>
                  <th className={TH}>Rev</th>
                  <th className={TH}>Verdict</th>
                  <th className={TH}>Issues</th>
                  <th className={TH}>Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {recentReviews.map((r) => {
                  const critical = r.issues.filter(
                    (i) => i.severity === "CRITICAL"
                  ).length;
                  const major = r.issues.filter(
                    (i) => i.severity === "MAJOR"
                  ).length;
                  const minor = r.issues.filter(
                    (i) => i.severity === "MINOR"
                  ).length;
                  return (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-zinc-50"
                    >
                      <td className={TD}>
                        <Link
                          href={`/submissions/${r.submission.id}`}
                          className="font-medium text-zinc-900 hover:text-zinc-600"
                        >
                          {r.submission.title}
                        </Link>
                      </td>
                      <td className={`${TD} text-zinc-400`}>
                        #{r.revisionNumber}
                      </td>
                      <td className={TD}>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLES[r.verdict]}`}
                        >
                          {VERDICT_LABELS[r.verdict]}
                        </span>
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-1.5">
                          {critical > 0 && (
                            <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                              {critical}C
                            </span>
                          )}
                          {major > 0 && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                              {major}M
                            </span>
                          )}
                          {minor > 0 && (
                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                              {minor}m
                            </span>
                          )}
                          {r.issues.length === 0 && (
                            <span className="text-zinc-300">None</span>
                          )}
                        </div>
                      </td>
                      <td className={`${TD} text-zinc-400`}>
                        {formatDate(r.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
