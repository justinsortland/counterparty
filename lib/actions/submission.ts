"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

const BUCKET = "artifacts";

export async function duplicateSubmission(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const submissionId = (formData.get("submissionId") as string)?.trim();
  if (!submissionId) redirect("/submissions");

  const source = await db.submission.findFirst({
    where: { id: submissionId, workspaceId },
    select: {
      title: true,
      address: true,
      jurisdiction: true,
      permitType: true,
      projectType: true,
      scopeOfWork: true,
      reviewContext: true,
    },
  });
  if (!source) redirect("/submissions");

  const baseTitle = source.title?.trim() || "Untitled submission";
  const newTitle = `${baseTitle} (Copy)`;

  const created = await db.submission.create({
    data: {
      workspaceId,
      title: newTitle,
      address: source.address,
      jurisdiction: source.jurisdiction,
      permitType: source.permitType,
      projectType: source.projectType,
      scopeOfWork: source.scopeOfWork,
      reviewContext: source.reviewContext,
      status: "DRAFT",
    },
    select: { id: true },
  });

  revalidatePath("/submissions");
  redirect(`/submissions/${created.id}`);
}

export async function deleteSubmission(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const submissionId = (formData.get("submissionId") as string)?.trim();
  if (!submissionId) redirect("/submissions");

  const submission = await db.submission.findFirst({
    where: { id: submissionId, workspaceId },
    select: {
      id: true,
      artifacts: { select: { storagePath: true } },
    },
  });
  if (!submission) redirect("/submissions");

  // Best-effort storage cleanup before DB transaction
  const storagePaths = submission.artifacts.map((a) => a.storagePath);
  if (storagePaths.length > 0) {
    const adminClient = createAdminClient();
    await adminClient.storage.from(BUCKET).remove(storagePaths).catch(() => {});
  }

  // Transactional deletion in dependency order
  await db.$transaction([
    db.reviewIssue.deleteMany({ where: { review: { submissionId } } }),
    db.review.deleteMany({ where: { submissionId } }),
    db.artifact.deleteMany({ where: { submissionId } }),
    db.submission.delete({ where: { id: submissionId } }),
  ]);

  revalidatePath("/submissions");
  const rawReturnTo = (formData.get("returnTo") as string | null)?.trim() ?? "";
  const returnTo = rawReturnTo.startsWith("/submissions") ? rawReturnTo : "/submissions";
  redirect(returnTo);
}
