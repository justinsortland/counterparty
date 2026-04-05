"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

async function getAuthedWorkspace(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return getWorkspaceId(user.id);
}

export async function saveAsTemplate(formData: FormData): Promise<void> {
  const workspaceId = await getAuthedWorkspace();

  const submissionId = (formData.get("submissionId") as string)?.trim();
  const rawName = (formData.get("name") as string)?.trim();
  const name = rawName || "Untitled template";

  if (!submissionId) return;

  const source = await db.submission.findFirst({
    where: { id: submissionId, workspaceId },
    select: {
      permitType: true,
      projectType: true,
      address: true,
      jurisdiction: true,
      scopeOfWork: true,
      reviewContext: true,
    },
  });
  if (!source) return;

  await db.submissionTemplate.create({
    data: {
      workspaceId,
      name,
      permitType: source.permitType,
      projectType: source.projectType,
      address: source.address,
      jurisdiction: source.jurisdiction,
      scopeOfWork: source.scopeOfWork,
      reviewContext: source.reviewContext,
    },
  });

  revalidatePath("/submissions/templates");
}

export async function createFromTemplate(formData: FormData): Promise<void> {
  const workspaceId = await getAuthedWorkspace();

  const templateId = (formData.get("templateId") as string)?.trim();
  if (!templateId) redirect("/submissions/templates");

  const template = await db.submissionTemplate.findFirst({
    where: { id: templateId, workspaceId },
  });
  if (!template) redirect("/submissions/templates");

  const created = await db.submission.create({
    data: {
      workspaceId,
      title: template.name,
      permitType: template.permitType,
      projectType: template.projectType,
      address: template.address,
      jurisdiction: template.jurisdiction,
      scopeOfWork: template.scopeOfWork,
      reviewContext: template.reviewContext,
      status: "DRAFT",
    },
    select: { id: true },
  });

  revalidatePath("/submissions");
  redirect(`/submissions/${created.id}`);
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const workspaceId = await getAuthedWorkspace();

  const templateId = (formData.get("templateId") as string)?.trim();
  if (!templateId) return;

  await db.submissionTemplate.deleteMany({
    where: { id: templateId, workspaceId },
  });

  revalidatePath("/submissions/templates");
}
