"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createSubmission, type CreateSubmissionState } from "./actions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

const PERMIT_TYPE_OPTIONS = [
  { value: "BUILDING", label: "Building" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "MECHANICAL", label: "Mechanical (HVAC)" },
  { value: "ZONING", label: "Zoning / Land Use" },
  { value: "GRADING", label: "Grading / Drainage" },
];

const PROJECT_TYPE_OPTIONS = [
  { value: "REMODEL", label: "Kitchen or Bath Remodel" },
  { value: "ADDITION", label: "Room Addition" },
  { value: "ADU", label: "ADU (Accessory Dwelling Unit)" },
  { value: "NEW_CONSTRUCTION", label: "New Construction" },
  { value: "DECK_PATIO", label: "Deck or Patio" },
  { value: "FENCE_WALL", label: "Fence or Retaining Wall" },
  { value: "POOL", label: "Pool or Spa" },
  { value: "DEMOLITION", label: "Demolition" },
  { value: "OTHER", label: "Other" },
];

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 bg-white placeholder:text-zinc-400";

const labelClass = "block text-sm font-medium text-zinc-700 mb-1";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function SubmissionForm() {
  const [state, formAction, isPending] = useActionState<
    CreateSubmissionState,
    FormData
  >(createSubmission, null);

  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {errors.form && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className={labelClass}>
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Kitchen remodel at 123 Main St"
          className={cn(inputClass, errors.title && "border-red-300 focus:border-red-400 focus:ring-red-100")}
        />
        <FieldError message={errors.title} />
      </div>

      {/* Address */}
      <div>
        <label htmlFor="address" className={labelClass}>
          Property Address <span className="text-red-500">*</span>
        </label>
        <input
          id="address"
          name="address"
          type="text"
          required
          placeholder="e.g. 123 Main St, San Francisco, CA 94105"
          className={cn(inputClass, errors.address && "border-red-300 focus:border-red-400 focus:ring-red-100")}
        />
        <FieldError message={errors.address} />
      </div>

      {/* Jurisdiction */}
      <div>
        <label htmlFor="jurisdiction" className={labelClass}>
          Jurisdiction <span className="text-red-500">*</span>
        </label>
        <input
          id="jurisdiction"
          name="jurisdiction"
          type="text"
          required
          placeholder="e.g. San Francisco, CA"
          className={cn(inputClass, errors.jurisdiction && "border-red-300 focus:border-red-400 focus:ring-red-100")}
        />
        <FieldError message={errors.jurisdiction} />
      </div>

      {/* Permit Type + Project Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="permitType" className={labelClass}>
            Permit Type <span className="text-red-500">*</span>
          </label>
          <select
            id="permitType"
            name="permitType"
            defaultValue=""
            className={cn(inputClass, errors.permitType && "border-red-300 focus:border-red-400 focus:ring-red-100")}
          >
            <option value="" disabled>Select permit type…</option>
            {PERMIT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <FieldError message={errors.permitType} />
        </div>

        <div>
          <label htmlFor="projectType" className={labelClass}>
            Project Type <span className="text-red-500">*</span>
          </label>
          <select
            id="projectType"
            name="projectType"
            defaultValue=""
            className={cn(inputClass, errors.projectType && "border-red-300 focus:border-red-400 focus:ring-red-100")}
          >
            <option value="" disabled>Select project type…</option>
            {PROJECT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <FieldError message={errors.projectType} />
        </div>
      </div>

      {/* Scope of Work */}
      <div>
        <label htmlFor="scopeOfWork" className={labelClass}>
          Scope of Work <span className="text-red-500">*</span>
        </label>
        <textarea
          id="scopeOfWork"
          name="scopeOfWork"
          rows={6}
          required
          placeholder="Describe all proposed work in detail. Include dimensions, materials, structural changes, and anything that touches electrical, plumbing, or mechanical systems."
          className={cn(inputClass, "resize-y", errors.scopeOfWork && "border-red-300 focus:border-red-400 focus:ring-red-100")}
        />
        <FieldError message={errors.scopeOfWork} />
      </div>

      {/* Review Context */}
      <div>
        <label htmlFor="reviewContext" className={labelClass}>
          Review Context{" "}
          <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="reviewContext"
          name="reviewContext"
          rows={3}
          placeholder="Any prior objections, special concerns, or focus areas for the reviewer."
          className={cn(inputClass, "resize-y")}
        />
        <p className="mt-1 text-xs text-zinc-400">
          Use this to flag known issues or guide the AI reviewer's focus.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/submissions"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ size: "sm" })}
        >
          {isPending ? "Creating…" : "Create submission"}
        </button>
      </div>
    </form>
  );
}
