"use client";

import { useEffect, useState } from "react";
import { saveAsTemplate } from "@/lib/actions/template";

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
      className={`text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
        saved ? "text-green-600" : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}
