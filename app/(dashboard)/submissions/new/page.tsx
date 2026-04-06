import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { SubmissionForm } from "./form";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { template: templateId } = await searchParams;
  const workspaceId = await getWorkspaceId(user.id);

  // Fetch all workspace templates for the selector (server-rendered links).
  const templates = await db.submissionTemplate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

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

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/submissions"
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Submissions
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          New Submission
        </h1>
      </div>

      <div className="max-w-xl">
        {/* Template selector — only rendered when templates exist */}
        {templates.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Start from a template:</span>
            {templates.map((t) =>
              t.id === selectedTemplate?.id ? (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                >
                  {t.name}
                  <Link
                    href="/submissions/new"
                    className="text-zinc-400 hover:text-zinc-600"
                    aria-label="Clear template"
                  >
                    ×
                  </Link>
                </span>
              ) : (
                <Link
                  key={t.id}
                  href={`/submissions/new?template=${t.id}`}
                  className="rounded-md px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  {t.name}
                </Link>
              )
            )}
          </div>
        )}

        <SubmissionForm defaultValues={defaultValues} />
      </div>
    </div>
  );
}
