"use client";

import { useTransition } from "react";
import { duplicateTemplate } from "@/lib/actions/template";

const SECONDARY_TEXT_CLS = "text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      className={SECONDARY_TEXT_CLS}
    >
      {isPending ? "Duplicating…" : "Duplicate"}
    </button>
  );
}
