"use server";

import { redirect } from "next/navigation";
import { PermitType, ProjectType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

type FormErrors = Partial<
  Record<"title" | "address" | "jurisdiction" | "permitType" | "projectType" | "scopeOfWork" | "form", string>
>;

export type CreateSubmissionState = { errors: FormErrors } | null;

const VALID_PERMIT_TYPES = Object.values(PermitType);
const VALID_PROJECT_TYPES = Object.values(ProjectType);

export async function createSubmission(
  _prevState: CreateSubmissionState,
  formData: FormData
): Promise<CreateSubmissionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const title = (formData.get("title") as string)?.trim();
  const address = (formData.get("address") as string)?.trim();
  const jurisdiction = (formData.get("jurisdiction") as string)?.trim();
  const permitType = formData.get("permitType") as PermitType;
  const projectType = formData.get("projectType") as ProjectType;
  const scopeOfWork = (formData.get("scopeOfWork") as string)?.trim();
  const reviewContext = (formData.get("reviewContext") as string)?.trim() || null;

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

  let submissionId: string;

  try {
    const submission = await db.submission.create({
      data: {
        workspaceId,
        title,
        address,
        jurisdiction,
        permitType,
        projectType,
        scopeOfWork,
        reviewContext,
      },
      select: { id: true },
    });
    submissionId = submission.id;
  } catch {
    return { errors: { form: "Something went wrong. Please try again." } };
  }

  redirect(`/submissions/${submissionId}`);
}
