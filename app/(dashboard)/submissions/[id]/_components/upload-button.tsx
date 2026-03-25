"use client";

import { useFormStatus } from "react-dom";

export function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
    >
      {pending ? "Uploading…" : "Upload file"}
    </button>
  );
}
