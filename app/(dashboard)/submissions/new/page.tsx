import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import { SubmissionForm } from "./form";
import type { Prisma } from "@prisma/client";

const SORT_OPTIONS: Record<string, Prisma.SubmissionTemplateOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name:   { name: "asc" },
};

const INPUT_CLS =
  "rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400";

/**
 * Builds a `/submissions/new` URL from the given params, omitting falsy values
 * and omitting `sort` when it is the default ("newest").
 */
function pickerUrl(params: {
  template?: string | null;
  q?: string;
  sort?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.template) sp.set("template", params.template);
  if (params.q) sp.set("q", params.q);
  if (params.sort && params.sort !== "newest") sp.set("sort", params.sort);
  const s = sp.toString();
  return `/submissions/new${s ? `?${s}` : ""}`;
}

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; q?: string; sort?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { template: templateId, q: rawQ, sort: rawSort } = await searchParams;
  const workspaceId = await getWorkspaceId(user.id);

  const q = rawQ?.trim() ?? "";
  const sort = rawSort && rawSort in SORT_OPTIONS ? rawSort : "newest";
  const hasFilters = !!q;

  // Fetch filtered + sorted templates for the picker chips.
  const templates = await db.submissionTemplate.findMany({
    where: {
      workspaceId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: SORT_OPTIONS[sort],
    select: { id: true, name: true },
  });

  // Total count so we can show the picker section even when the filter returns 0.
  const totalTemplateCount = hasFilters
    ? await db.submissionTemplate.count({ where: { workspaceId } })
    : templates.length;

  // Resolve the selected template only if a param was provided — workspace
  // ownership is enforced. Null means missing, deleted, or unauthorized.
  const selectedTemplate = templateId
    ? await db.submissionTemplate.findFirst({
        where: { id: templateId, workspaceId },
      })
    : null;

  const defaultValues = selectedTemplate
    ? {
        title: selectedTemplate.name,
        address: selectedTemplate.address,
        jurisdiction: selectedTemplate.jurisdiction,
        permitType: selectedTemplate.permitType,
        projectType: selectedTemplate.projectType,
        scopeOfWork: selectedTemplate.scopeOfWork,
        reviewContext: selectedTemplate.reviewContext,
      }
    : undefined;

  // Chips for unselected templates (selected one is rendered separately).
  const unselectedChips = templates.filter((t) => t.id !== selectedTemplate?.id);

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/submissions" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Submissions
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">New Submission</h1>
      </div>

      <div className="max-w-xl">
        {totalTemplateCount > 0 && (
          <div className="mb-5">
            {/* Search + sort form — hidden `template` preserves active prefill */}
            <form method="GET" className="mb-3 flex flex-wrap items-center gap-2">
              {selectedTemplate && (
                <input type="hidden" name="template" value={selectedTemplate.id} />
              )}
              <input
                name="q"
                defaultValue={q}
                placeholder="Search templates…"
                className={`${INPUT_CLS} w-44`}
              />
              <select name="sort" defaultValue={sort} className={INPUT_CLS}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name A → Z</option>
              </select>
              <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Apply
              </button>
              {hasFilters && (
                <Link
                  href={pickerUrl({ template: selectedTemplate?.id, sort })}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  × Clear
                </Link>
              )}
            </form>

            {/* Template chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400">Start from a template:</span>

              {/* Selected chip — always shown when a template is active, even if filtered out */}
              {selectedTemplate && (
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {selectedTemplate.name}
                  <Link
                    href={pickerUrl({ q, sort })}
                    className="text-zinc-400 hover:text-zinc-600"
                    aria-label="Clear template"
                  >
                    ×
                  </Link>
                </span>
              )}

              {unselectedChips.map((t) => (
                <Link
                  key={t.id}
                  href={pickerUrl({ template: t.id, q, sort })}
                  className="rounded-md px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  {t.name}
                </Link>
              ))}

              {unselectedChips.length === 0 && !selectedTemplate && (
                <span className="text-xs text-zinc-400">
                  No templates match.{" "}
                  <Link
                    href={pickerUrl({ sort })}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    × Clear search
                  </Link>
                </span>
              )}
            </div>
          </div>
        )}

        <SubmissionForm defaultValues={defaultValues} />
      </div>
    </div>
  );
}
