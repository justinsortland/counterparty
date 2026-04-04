"use client";

import { useTransition } from "react";
import { deleteSubmission } from "@/lib/actions/submission";

export function DeleteButton({
  submissionId,
  title,
}: {
  submissionId: string;
  title?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const label = title ? `Delete submission "${title}"?` : "Permanently delete this submission and all its data?";
    if (!confirm(`${label}\n\nThis cannot be undone.`)) {
      return;
    }
    const formData = new FormData();
    formData.set("submissionId", submissionId);
    startTransition(() => deleteSubmission(formData));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
