import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import { duplicateTemplate } from "@/lib/actions/template";
import { DeleteTemplateButton } from "./_components/delete-template-button";
import type { PermitType, ProjectType, Prisma } from "@prisma/client";

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

const SORT_OPTIONS: Record<string, Prisma.SubmissionTemplateOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name:   { name: "asc" },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const INPUT_CLS =
  "rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400";
const TH = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
const TD = "px-4 py-3 text-sm";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const { q: rawQ, sort: rawSort } = await searchParams;

  const q = rawQ?.trim() ?? "";
  const sort = rawSort && rawSort in SORT_OPTIONS ? rawSort : "newest";
  const hasFilters = !!(q);

  const templates = await db.submissionTemplate.findMany({
    where: {
      workspaceId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: SORT_OPTIONS[sort],
    select: {
      id: true,
      name: true,
      permitType: true,
      projectType: true,
      createdAt: true,
    },
  });

  // Total count for detecting "no results vs. no templates at all"
  const totalCount = hasFilters
    ? await db.submissionTemplate.count({ where: { workspaceId } })
    : templates.length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/submissions" className="text-sm text-zinc-400 hover:text-zinc-600">
            ← Submissions
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-zinc-900">Templates</h1>
        </div>
      </div>

      {totalCount === 0 ? (
        // Truly empty — no templates in the workspace at all
        <div className="rounded-lg border border-dashed border-zinc-200 py-16 text-center">
          <p className="text-sm font-medium text-zinc-900">No templates yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Open a submission and click &ldquo;Save as template&rdquo; to create one.
          </p>
          <div className="mt-4">
            <Link href="/submissions" className={buttonVariants({ size: "sm" })}>
              Go to submissions
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Search + sort form */}
          <form method="GET" className="mb-5 flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name…"
              className={`${INPUT_CLS} w-52`}
            />
            <select
              name="sort"
              defaultValue={sort}
              className={INPUT_CLS}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A → Z</option>
            </select>
            <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Apply
            </button>
            {hasFilters && (
              <Link
                href="/submissions/templates"
                className="text-sm text-zinc-400 hover:text-zinc-600"
              >
                × Clear
              </Link>
            )}
          </form>

          {templates.length === 0 ? (
            // Templates exist but none match the current search
            <div className="rounded-lg border border-zinc-200 py-12 text-center">
              <p className="text-sm text-zinc-500">No templates match your search.</p>
              <Link
                href="/submissions/templates"
                className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-600"
              >
                × Clear search
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className={TH}>Name</th>
                    <th className={TH}>Permit Type</th>
                    <th className={TH}>Project Type</th>
                    <th className={TH}>Saved</th>
                    <th className={TH}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {templates.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-zinc-50">
                      <td className={`${TD} font-medium text-zinc-900`}>{t.name}</td>
                      <td className={TD}>
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          {PERMIT_TYPE_LABELS[t.permitType]}
                        </span>
                      </td>
                      <td className={`${TD} text-zinc-500`}>
                        {PROJECT_TYPE_LABELS[t.projectType]}
                      </td>
                      <td className={`${TD} text-zinc-400`}>{formatDate(t.createdAt)}</td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/submissions/new?template=${t.id}`}
                            className="text-sm text-zinc-500 hover:text-zinc-700"
                          >
                            Use
                          </Link>
                          <form action={duplicateTemplate}>
                            <input type="hidden" name="templateId" value={t.id} />
                            <button
                              type="submit"
                              className="text-sm text-zinc-500 hover:text-zinc-700"
                            >
                              Duplicate
                            </button>
                          </form>
                          <Link
                            href={`/submissions/templates/${t.id}/edit`}
                            className="text-sm text-zinc-500 hover:text-zinc-700"
                          >
                            Edit
                          </Link>
                          <DeleteTemplateButton templateId={t.id} templateName={t.name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
