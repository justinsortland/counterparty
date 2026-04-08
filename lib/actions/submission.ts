"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

const BUCKET = "artifacts";

function makeCopyName(name: string | null | undefined): string {
  const base = name?.trim() || "Untitled submission";
  const root = base.replace(/\s+Copy(\s+\(\d+\))?$/i, "");
  return `${root} Copy`;
}

function makeUniqueName(base: string, existing: Set<string>): string {
  const norm = (s: string) => s.trim().toLowerCase();
  const existingNorm = new Set([...existing].map(norm));
  if (!existingNorm.has(norm(base))) return base;
  let n = 2;
  while (existingNorm.has(norm(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}

export async function deleteSubmissions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  // Only operate on submissions owned by this workspace
  const owned = await db.submission.findMany({
    where: { id: { in: ids }, workspaceId },
    select: {
      id: true,
      artifacts: { select: { storagePath: true } },
    },
  });
  if (owned.length === 0) return;

  const validIds = owned.map((s) => s.id);
  const storagePaths = owned.flatMap((s) => s.artifacts.map((a) => a.storagePath));

  if (storagePaths.length > 0) {
    const adminClient = createAdminClient();
    await adminClient.storage.from(BUCKET).remove(storagePaths).catch(() => {});
  }

  await db.$transaction([
    db.reviewIssue.deleteMany({ where: { review: { submissionId: { in: validIds } } } }),
    db.review.deleteMany({ where: { submissionId: { in: validIds } } }),
    db.artifact.deleteMany({ where: { submissionId: { in: validIds } } }),
    db.submission.deleteMany({ where: { id: { in: validIds } } }),
  ]);

  revalidatePath("/submissions");
}

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

  const copyBase = makeCopyName(source.title);

  const siblings = await db.submission.findMany({
    where: { workspaceId },
    select: { title: true },
  });
  const newTitle = makeUniqueName(copyBase, new Set(siblings.map((s) => s.title)));

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
