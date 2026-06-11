"use client";

import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/lib/button-variants";

export function RequestReviewButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonVariants({ variant: "default", size: "sm" })}
    >
      {pending ? "Requesting…" : "Request Review"}
    </button>
  );
}
