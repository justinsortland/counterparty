"use client";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/lib/button-variants";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "print:hidden")}
    >
      Print / Save as PDF
    </button>
  );
}
