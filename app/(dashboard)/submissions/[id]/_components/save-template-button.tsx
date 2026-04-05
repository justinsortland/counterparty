"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveAsTemplate } from "@/lib/actions/template";

export function SaveTemplateButton({
  submissionId,
  defaultName,
}: {
  submissionId: string;
  defaultName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  // Detect transition completing (isPending: true → false) to show "Saved!"
  useEffect(() => {
    if (wasPending.current && !isPending) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
    wasPending.current = isPending;
  }, [isPending]);

  function handleClick() {
    const trimmed = defaultName.trim() || "Untitled template";
    const name = window.prompt("Save as template — name:", trimmed);
    if (name === null) return; // cancelled
    const formData = new FormData();
    formData.set("submissionId", submissionId);
    formData.set("name", name.trim() || trimmed);
    startTransition(() => saveAsTemplate(formData));
  }

  const label = saved ? "Saved!" : isPending ? "Saving…" : "Save as template";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
        saved ? "text-green-600" : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}
