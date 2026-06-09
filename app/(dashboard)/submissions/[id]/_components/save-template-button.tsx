"use client";

import { useEffect, useState } from "react";
import { saveAsTemplate } from "@/lib/actions/template";

const SECONDARY_TEXT_CLS = "text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SaveTemplateButton({
  submissionId,
  defaultName,
}: {
  submissionId: string;
  defaultName: string;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-reset "Saved!" after 2 seconds.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  async function handleClick() {
    const trimmed = defaultName.trim() || "Untitled template";
    const name = window.prompt("Save as template — name:", trimmed);
    if (name === null) return; // cancelled
    const formData = new FormData();
    formData.set("submissionId", submissionId);
    formData.set("name", name.trim() || trimmed);
    setIsSaving(true);
    try {
      await saveAsTemplate(formData);
      setSaved(true);
    } finally {
      setIsSaving(false);
    }
  }

  const label = saved ? "Saved!" : isSaving ? "Saving…" : "Save as template";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSaving}
      className={saved ? "text-sm text-green-600 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : SECONDARY_TEXT_CLS}
    >
      {label}
    </button>
  );
}
