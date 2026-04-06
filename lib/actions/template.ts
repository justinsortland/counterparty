"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PermitType, ProjectType } from "@prisma/client";
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

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

type TemplateFieldErrors = Partial<
  Record<"name" | "address" | "jurisdiction" | "permitType" | "projectType" | "scopeOfWork", string>
>;
type UpdateTemplateFormErrors = TemplateFieldErrors & { form?: string };
export type UpdateTemplateState = { errors: UpdateTemplateFormErrors } | null;

const VALID_PERMIT_TYPES = Object.values(PermitType);
const VALID_PROJECT_TYPES = Object.values(ProjectType);

export async function updateTemplate(
  _prevState: UpdateTemplateState,
  formData: FormData
): Promise<UpdateTemplateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const templateId = (formData.get("templateId") as string)?.trim();
  if (!templateId) return { errors: { form: "Missing template ID." } };

  const existing = await db.submissionTemplate.findFirst({
    where: { id: templateId, workspaceId },
    select: { id: true },
  });
  if (!existing) return { errors: { form: "Template not found." } };

  const rawName = (formData.get("name") as string)?.trim();
  const baseName = rawName || "Untitled template";
  const address = (formData.get("address") as string)?.trim();
  const jurisdiction = (formData.get("jurisdiction") as string)?.trim();
  const permitType = formData.get("permitType") as PermitType;
  const projectType = formData.get("projectType") as ProjectType;
  const scopeOfWork = (formData.get("scopeOfWork") as string)?.trim();
  const reviewContext = (formData.get("reviewContext") as string)?.trim() || null;

  const errors: UpdateTemplateFormErrors = {};
  if (!address) errors.address = "Address is required.";
  if (!jurisdiction) errors.jurisdiction = "Jurisdiction is required.";
  if (!permitType || !VALID_PERMIT_TYPES.includes(permitType))
    errors.permitType = "Permit type is required.";
  if (!projectType || !VALID_PROJECT_TYPES.includes(projectType))
    errors.projectType = "Project type is required.";
  if (!scopeOfWork) errors.scopeOfWork = "Scope of work is required.";
  if (Object.keys(errors).length > 0) return { errors };

  // Dedupe name against all other templates in the workspace (excluding self).
  const siblings = await db.submissionTemplate.findMany({
    where: { workspaceId, NOT: { id: templateId } },
    select: { name: true },
  });
  const name = makeUniqueName(baseName, new Set(siblings.map((t) => t.name)));

  try {
    await db.submissionTemplate.update({
      where: { id: templateId },
      data: { name, permitType, projectType, address, jurisdiction, scopeOfWork, reviewContext },
    });
  } catch {
    return { errors: { form: "Something went wrong. Please try again." } };
  }

  revalidatePath("/submissions/templates");
  redirect("/submissions/templates");
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

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
