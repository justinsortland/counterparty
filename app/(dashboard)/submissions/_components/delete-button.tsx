"use client";

import { useTransition } from "react";
import { deleteSubmission } from "@/lib/actions/submission";

const DESTRUCTIVE_TEXT_CLS = "text-sm text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DeleteButton({
  submissionId,
  title,
  returnTo,
  externalDeleting,
}: {
  submissionId: string;
  title?: string;
  returnTo?: string;
  externalDeleting?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const deleting = isPending || externalDeleting;

  function handleClick() {
    const label = title ? `Delete submission "${title}"?` : "Permanently delete this submission and all its data?";
    if (!confirm(`${label}\n\nThis cannot be undone.`)) {
      return;
    }
    const formData = new FormData();
    formData.set("submissionId", submissionId);
    if (returnTo) formData.set("returnTo", returnTo);
    startTransition(() => deleteSubmission(formData));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={deleting}
      className={DESTRUCTIVE_TEXT_CLS}
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
