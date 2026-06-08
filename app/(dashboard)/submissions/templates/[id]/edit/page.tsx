import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { EditTemplateForm } from "./form";

export default async function EditTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const workspaceId = await getWorkspaceId(user.id);

  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = /^\/submissions\/templates(\?.*)?$/.test(rawReturnTo ?? "")
    ? rawReturnTo!
    : undefined;

  const backUrl = returnTo ?? "/submissions/templates";

  const template = await db.submissionTemplate.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      name: true,
      address: true,
      jurisdiction: true,
      permitType: true,
      projectType: true,
      scopeOfWork: true,
      reviewContext: true,
    },
  });

  if (!template) redirect("/submissions/templates");

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={backUrl}
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Templates
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">Edit Template</h1>
      </div>

      <div className="max-w-xl">
        <EditTemplateForm template={template} returnTo={returnTo} />
      </div>
    </div>
  );
}
