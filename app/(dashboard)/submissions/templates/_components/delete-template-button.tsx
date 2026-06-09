"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplate } from "@/lib/actions/template";

const DESTRUCTIVE_TEXT_CLS = "text-sm text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DeleteTemplateButton({
  templateId,
  templateName,
  externalDeleting,
}: {
  templateId: string;
  templateName: string;
  externalDeleting?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const deleting = isPending || externalDeleting;

  function handleClick() {
    if (!confirm(`Delete template "${templateName}"?\n\nThis cannot be undone.`)) return;
    const formData = new FormData();
    formData.set("templateId", templateId);
    startTransition(async () => {
      await deleteTemplate(formData);
      router.refresh();
    });
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
