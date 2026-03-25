"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { runReview, REVIEW_MODEL, PROMPT_VERSION } from "@/lib/ai/reviewer";
import { selectProfile } from "@/lib/ai/review-profiles";
import type { SubmissionStatus } from "@prisma/client";

export async function requestReview(formData: FormData): Promise<void> {
  console.log("[review] ── entry");
  console.log("[review] ANTHROPIC_API_KEY set:", !!process.env.ANTHROPIC_API_KEY);

  let submissionId: string | undefined;

  try {
    // ── Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("[review] auth:", user ? `uid=${user.id}` : "NO USER");
    if (!user) redirect("/login");

    // ── Workspace
    const workspaceId = await getWorkspaceId(user.id);
    console.log("[review] workspaceId:", workspaceId);

    // ── submissionId from form
    const rawId = (formData.get("submissionId") as string)?.trim();
    console.log("[review] submissionId:", rawId);
    if (!rawId) throw new Error("Missing submissionId");
    submissionId = rawId; // assign outer let for catch-block redirect

    // ── Ownership check
    const submission = await db.submission.findFirst({
      where: { id: rawId, workspaceId },
      select: {
        id: true,
        title: true,
        address: true,
        jurisdiction: true,
        permitType: true,
        projectType: true,
        scopeOfWork: true,
        reviewContext: true,
        artifacts: {
          orderBy: { createdAt: "asc" },
          select: { fileName: true, mimeType: true, sizeBytes: true, documentLabel: true },
        },
      },
    });
    console.log("[review] submission found:", !!submission);
    if (!submission) throw new Error("Submission not found");

    // ── Revision number
    const existingCount = await db.review.count({ where: { submissionId: rawId } });
    const revisionNumber = existingCount + 1;
    console.log("[review] revisionNumber:", revisionNumber);

    // ── Profile
    const profile = selectProfile(submission.permitType, submission.projectType);
    console.log("[review] profile:", profile.id);

    // ── AI call
    console.log("[review] calling runReview — model:", REVIEW_MODEL);
    const result = await runReview({
      title: submission.title,
      address: submission.address,
      jurisdiction: submission.jurisdiction,
      permitType: submission.permitType,
      projectType: submission.projectType,
      scopeOfWork: submission.scopeOfWork,
      reviewContext: submission.reviewContext,
      artifacts: submission.artifacts,
      profile,
    });
    console.log(
      "[review] runReview complete — verdict:", result.verdict,
      "issues:", result.issues.length,
      "missingDocs:", result.missingDocs.length
    );

    // ── Status
    const hasCritical = result.issues.some((i) => i.severity === "CRITICAL");
    const newStatus: SubmissionStatus = hasCritical ? "NEEDS_REVISION" : "REVIEWED";
    console.log("[review] newStatus:", newStatus);

    // ── Transaction
    console.log("[review] starting transaction");
    await db.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          workspaceId,
          submissionId: rawId,
          revisionNumber,
          snapshotTitle: submission.title,
          snapshotScopeOfWork: submission.scopeOfWork,
          snapshotJurisdiction: submission.jurisdiction,
          snapshotPermitType: submission.permitType,
          snapshotProjectType: submission.projectType,
          snapshotReviewContext: submission.reviewContext,
          snapshotArtifacts: submission.artifacts.map((a) =>
            JSON.stringify({
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              documentLabel: a.documentLabel ?? null,
            })
          ),
          modelVersion: REVIEW_MODEL,
          promptVersion: PROMPT_VERSION,
          rawPayload: result.rawPayload,
          verdict: result.verdict,
          summary: result.summary,
          missingDocs: result.missingDocs,
          issues: {
            create: result.issues.map((issue) => ({
              severity: issue.severity,
              category: issue.category,
              description: issue.description,
              codeReference: issue.codeReference,
            })),
          },
        },
      });

      await tx.submission.update({
        where: { id: rawId },
        data: { status: newStatus },
      });
    });
    console.log("[review] transaction complete");

  } catch (err) {
    console.error("[review] ── ERROR ──");
    console.error(err);
    // Redirect back with an error flag so the UI can surface it rather than
    // failing silently. Only possible if we got far enough to have submissionId.
    if (submissionId) {
      redirect(`/submissions/${submissionId}?review_error=1`);
    }
    throw err;
  }

  console.log("[review] redirecting to /submissions/" + submissionId);
  redirect(`/submissions/${submissionId}`);
}
