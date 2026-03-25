"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

const BUCKET = "artifacts";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadArtifact(formData: FormData): Promise<void> {
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
    select: { id: true },
  });
  if (!submission) redirect("/submissions");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    redirect(`/submissions/${submissionId}?upload_error=1`);
  }

  const storagePath = `${workspaceId}/${submissionId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const adminClient = createAdminClient();

  const { error: storageError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (storageError) {
    redirect(`/submissions/${submissionId}?upload_error=1`);
  }

  // If DB insert fails, remove the uploaded object to avoid orphans
  try {
    await db.artifact.create({
      data: {
        workspaceId,
        submissionId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storagePath,
      },
    });
  } catch {
    await adminClient.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    redirect(`/submissions/${submissionId}?upload_error=1`);
  }

  redirect(`/submissions/${submissionId}`);
}

export async function deleteArtifact(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const artifactId = (formData.get("artifactId") as string)?.trim();
  const submissionId = (formData.get("submissionId") as string)?.trim();
  if (!artifactId || !submissionId) redirect("/submissions");

  const artifact = await db.artifact.findFirst({
    where: { id: artifactId, workspaceId },
    select: { id: true, storagePath: true },
  });
  if (!artifact) redirect(`/submissions/${submissionId}`);

  const adminClient = createAdminClient();

  // Best-effort storage delete — DB record is the source of truth
  await adminClient.storage.from(BUCKET).remove([artifact.storagePath]).catch(() => {});

  await db.artifact.delete({ where: { id: artifactId } });

  redirect(`/submissions/${submissionId}`);
}
