"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplate } from "@/lib/actions/template";

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
      className="text-sm text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
