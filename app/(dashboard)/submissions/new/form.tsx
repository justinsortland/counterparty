"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createSubmission, type CreateSubmissionState } from "./actions";
import { buttonVariants } from "@/lib/button-variants";
import {
  SubmissionFields,
  type SubmissionDefaultValues,
} from "../_components/submission-fields";

export function SubmissionForm({
  defaultValues,
}: {
  defaultValues?: SubmissionDefaultValues;
}) {
  const [state, formAction, isPending] = useActionState<
    CreateSubmissionState,
    FormData
  >(createSubmission, null);

  const errors = state?.errors ?? {};

  // Submitted values from a failed attempt take priority over template defaults.
  const displayValues = state?.values ?? defaultValues;

  // Key over all displayed fields so SubmissionFields remounts — and re-applies
  // defaultValue — whenever the visible data set changes (template switch or
  // validation round-trip returning different values).
  const fieldsKey = JSON.stringify(displayValues ?? null);

  return (
    <form action={formAction} className="space-y-5">
      {errors.form && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}

      <SubmissionFields key={fieldsKey} defaultValues={displayValues} errors={errors} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/submissions"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ size: "sm" })}
        >
          {isPending ? "Creating…" : "Create submission"}
        </button>
      </div>
    </form>
  );
}
