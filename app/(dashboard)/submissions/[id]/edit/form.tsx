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
  returnTo,
}: {
  submission: SubmissionDefaultValues & { id: string };
  returnTo?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    UpdateSubmissionState,
    FormData
  >(updateSubmission, null);

  const errors = state?.errors ?? {};
  const displayValues = state?.values ?? submission;
  const fieldsKey = JSON.stringify(displayValues);

  return (
    <form action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="submissionId" value={submission.id} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      {errors.form && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}

      <SubmissionFields key={fieldsKey} defaultValues={displayValues} errors={errors} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={`/submissions/${submission.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
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
