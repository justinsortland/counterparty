"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplate } from "@/lib/actions/template";

export function DeleteTemplateButton({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
      disabled={isPending}
      className="text-sm text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
