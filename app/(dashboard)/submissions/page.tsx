import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import { FilterBar } from "./_components/filter-bar";
import { SubmissionsTable } from "./_components/submissions-table";
import type { PermitType, ProjectType, SubmissionStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Validation sets (keeps Prisma types sound; unknown URL values are ignored)
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set<string>(["DRAFT", "REVIEWED", "NEEDS_REVISION"]);
const VALID_PERMIT_TYPES = new Set<string>(["BUILDING", "ELECTRICAL", "PLUMBING", "MECHANICAL", "ZONING", "GRADING"]);
const VALID_PROJECT_TYPES = new Set<string>(["REMODEL", "ADDITION", "ADU", "NEW_CONSTRUCTION", "DECK_PATIO", "FENCE_WALL", "POOL", "DEMOLITION", "OTHER"]);

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface SubmissionFilters {
  q?: string;
  status?: SubmissionStatus;
  permitType?: PermitType;
  projectType?: ProjectType;
}

async function getSubmissions(workspaceId: string, filters: SubmissionFilters = {}) {
  const { q, status, permitType, projectType } = filters;
  return db.submission.findMany({
    where: {
      workspaceId,
      ...(q && { title: { contains: q, mode: "insensitive" } }),
      ...(status && { status }),
      ...(permitType && { permitType }),
      ...(projectType && { projectType }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      address: true,
      permitType: true,
      projectType: true,
      status: true,
      updatedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    permitType?: string;
    projectType?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const { q: rawQ, status: rawStatus, permitType: rawPermit, projectType: rawProject } =
    await searchParams;

  const q = rawQ?.trim() || undefined;
  const status = VALID_STATUSES.has(rawStatus ?? "")
    ? (rawStatus as SubmissionStatus)
    : undefined;
  const permitType = VALID_PERMIT_TYPES.has(rawPermit ?? "")
    ? (rawPermit as PermitType)
    : undefined;
  const projectType = VALID_PROJECT_TYPES.has(rawProject ?? "")
    ? (rawProject as ProjectType)
    : undefined;

  const hasFilters = !!(q || status || permitType || projectType);

  const submissions = await getSubmissions(workspaceId, { q, status, permitType, projectType });

  // Serialize dates — Date objects become ISO strings when crossing the
  // server → client component boundary.
  const rows = submissions.map((s) => ({
    ...s,
    updatedAt: s.updatedAt.toISOString(),
  }));

  // Build returnTo so per-row delete redirects back to the filtered list
  const filterParams = new URLSearchParams({
    ...(q && { q }),
    ...(status && { status }),
    ...(permitType && { permitType }),
    ...(projectType && { projectType }),
  }).toString();
  const returnTo = filterParams ? `/submissions?${filterParams}` : "/submissions";

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

      <FilterBar />

      {submissions.length === 0 ? (
        hasFilters ? (
          <div className="rounded-lg border border-zinc-200 py-12 text-center">
            <p className="text-sm text-zinc-500">No submissions match your filters.</p>
            <Link
              href="/submissions"
              className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-600"
            >
              Clear filters
            </Link>
          </div>
        ) : (
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
        )
      ) : (
        <SubmissionsTable submissions={rows} returnTo={returnTo} />
      )}
    </div>
  );
}
