"use client";

import { useTransition } from "react";
import { duplicateTemplate } from "@/lib/actions/template";

export function DuplicateTemplateButton({ templateId }: { templateId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const formData = new FormData();
    formData.set("templateId", templateId);
    startTransition(() => duplicateTemplate(formData));
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
