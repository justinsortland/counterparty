"use client";

import { useTransition } from "react";
import { duplicateSubmission } from "@/lib/actions/submission";

export function DuplicateButton({
  submissionId,
}: {
  submissionId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const formData = new FormData();
    formData.set("submissionId", submissionId);
    startTransition(() => duplicateSubmission(formData));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "Duplicating…" : "Duplicate"}
    </button>
  );
}
