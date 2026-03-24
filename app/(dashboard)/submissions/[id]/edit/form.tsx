"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateSubmission, type UpdateSubmissionState } from "./actions";
import { buttonVariants } from "@/lib/button-variants";
import {
  SubmissionFields,
  type SubmissionDefaultValues,
} from "../../_components/submission-fields";

export function EditSubmissionForm({
  submission,
}: {
  submission: SubmissionDefaultValues & { id: string };
}) {
  const [state, formAction, isPending] = useActionState<
    UpdateSubmissionState,
    FormData
  >(updateSubmission, null);

  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="submissionId" value={submission.id} />

      {errors.form && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}

      <SubmissionFields defaultValues={submission} errors={errors} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={`/submissions/${submission.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ size: "sm" })}
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
