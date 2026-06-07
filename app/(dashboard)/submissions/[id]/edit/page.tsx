import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { EditSubmissionForm } from "./form";

async function getSubmissionForEdit(id: string, workspaceId: string) {
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
      reviewContext: true,
    },
  });
}

export default async function EditSubmissionPage({
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
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = /^\/submissions(\?.*)?$/.test(rawReturnTo ?? "") ? rawReturnTo : undefined;
  const workspaceId = await getWorkspaceId(user.id);
  const submission = await getSubmissionForEdit(id, workspaceId);

  if (!submission) redirect("/submissions");

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/submissions/${id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Back to submission
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Edit Submission
        </h1>
      </div>

      <div className="max-w-xl">
        <EditSubmissionForm submission={submission} returnTo={returnTo} />
      </div>
    </div>
  );
}
