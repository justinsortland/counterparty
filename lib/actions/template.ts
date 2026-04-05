"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthedWorkspace(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return getWorkspaceId(user.id);
}

/**
 * Returns `base` if it does not appear in `existing` (case-insensitive,
 * trimmed), otherwise appends the lowest available numeric suffix:
 *   "Foo" → "Foo (2)" → "Foo (3)" …
 */
function makeUniqueName(base: string, existing: Set<string>): string {
  const norm = (s: string) => s.trim().toLowerCase();
  const existingNorm = new Set([...existing].map(norm));
  if (!existingNorm.has(norm(base))) return base;
  let n = 2;
  while (existingNorm.has(norm(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function saveAsTemplate(formData: FormData): Promise<void> {
  const workspaceId = await getAuthedWorkspace();

  const submissionId = (formData.get("submissionId") as string)?.trim();
  const rawName = (formData.get("name") as string)?.trim();
  const baseName = rawName || "Untitled template";

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

  const existingTemplates = await db.submissionTemplate.findMany({
    where: { workspaceId },
    select: { name: true },
  });
  const name = makeUniqueName(baseName, new Set(existingTemplates.map((t) => t.name)));

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

  const existingSubmissions = await db.submission.findMany({
    where: { workspaceId },
    select: { title: true },
  });
  const title = makeUniqueName(template.name, new Set(existingSubmissions.map((s) => s.title)));

  const created = await db.submission.create({
    data: {
      workspaceId,
      title,
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

  // deleteMany is a no-op if the record doesn't exist or belongs to another
  // workspace — repeat clicks and refresh races are handled safely.
  await db.submissionTemplate.deleteMany({
    where: { id: templateId, workspaceId },
  });

  revalidatePath("/submissions/templates");
}
