"use server";

import { redirect } from "next/navigation";
import { PermitType, ProjectType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import type { SubmissionFieldErrors } from "../../_components/submission-fields";

type FormErrors = SubmissionFieldErrors & { form?: string };

export type UpdateSubmissionState = { errors: FormErrors } | null;

const VALID_PERMIT_TYPES = Object.values(PermitType);
const VALID_PROJECT_TYPES = Object.values(ProjectType);

export async function updateSubmission(
  _prevState: UpdateSubmissionState,
  formData: FormData
): Promise<UpdateSubmissionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const submissionId = (formData.get("submissionId") as string)?.trim();
  if (!submissionId) return { errors: { form: "Missing submission ID." } };

  const existing = await db.submission.findFirst({
    where: { id: submissionId, workspaceId },
    select: { id: true },
  });
  if (!existing) return { errors: { form: "Submission not found." } };

  const title = (formData.get("title") as string)?.trim();
  const address = (formData.get("address") as string)?.trim();
  const jurisdiction = (formData.get("jurisdiction") as string)?.trim();
  const permitType = formData.get("permitType") as PermitType;
  const projectType = formData.get("projectType") as ProjectType;
  const scopeOfWork = (formData.get("scopeOfWork") as string)?.trim();
  const reviewContext =
    (formData.get("reviewContext") as string)?.trim() || null;

  const errors: FormErrors = {};

  if (!title) errors.title = "Title is required.";
  if (!address) errors.address = "Address is required.";
  if (!jurisdiction) errors.jurisdiction = "Jurisdiction is required.";
  if (!permitType || !VALID_PERMIT_TYPES.includes(permitType))
    errors.permitType = "Permit type is required.";
  if (!projectType || !VALID_PROJECT_TYPES.includes(projectType))
    errors.projectType = "Project type is required.";
  if (!scopeOfWork) errors.scopeOfWork = "Scope of work is required.";

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await db.submission.update({
      where: { id: submissionId },
      data: { title, address, jurisdiction, permitType, projectType, scopeOfWork, reviewContext },
    });
  } catch {
    return { errors: { form: "Something went wrong. Please try again." } };
  }

  redirect(`/submissions/${submissionId}`);
}
