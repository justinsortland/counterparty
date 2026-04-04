import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import { DeleteButton } from "./_components/delete-button";
import type { PermitType, ProjectType, SubmissionStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getSubmissions(workspaceId: string) {
  return db.submission.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      address: true,
      permitType: true,
      projectType: true,
      status: true,
      createdAt: true,
      updatedAt: true,
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const TH =
  "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
const TD = "px-4 py-3 text-sm";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubmissionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const submissions = await getSubmissions(workspaceId);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Submissions</h1>
        <Link
          href="/submissions/new"
          className={buttonVariants({ size: "sm" })}
        >
          + New Submission
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 py-16 text-center">
          <p className="text-sm font-medium text-zinc-900">No submissions yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Create your first permit submission to get an AI review.
          </p>
          <div className="mt-4">
            <Link
              href="/submissions/new"
              className={buttonVariants({ size: "sm" })}
            >
              + New Submission
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className={TH}>Title</th>
                <th className={TH}>Permit Type</th>
                <th className={TH}>Project Type</th>
                <th className={TH}>Status</th>
                <th className={TH}>Updated</th>
                <th className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {submissions.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-zinc-50">
                  <td className={TD}>
                    <Link
                      href={`/submissions/${s.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-600"
                    >
                      {s.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-400">{s.address}</p>
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {PERMIT_TYPE_LABELS[s.permitType]}
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="text-zinc-500">
                      {PROJECT_TYPE_LABELS[s.projectType]}
                    </span>
                  </td>
                  <td className={TD}>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}
                    >
                      {STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className={`${TD} text-zinc-400`}>
                    {formatDate(s.updatedAt)}
                  </td>
                  <td className={`${TD} text-right`}>
                    <DeleteButton submissionId={s.id} title={s.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
