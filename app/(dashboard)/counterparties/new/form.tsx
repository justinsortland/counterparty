"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCounterparty, type CreateCounterpartyState } from "./actions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "COMPANY", label: "Company" },
  { value: "FUND", label: "Fund" },
  { value: "VENDOR", label: "Vendor" },
  { value: "CLIENT", label: "Client" },
  { value: "RECRUITER", label: "Recruiter" },
  { value: "INDIVIDUAL", label: "Individual" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "WATCH", label: "Watch" },
  { value: "INACTIVE", label: "Inactive" },
];

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 bg-white placeholder:text-zinc-400";

const labelClass = "block text-sm font-medium text-zinc-700 mb-1";

const fieldErrorClass = "mt-1 text-xs text-red-600";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={fieldErrorClass}>{message}</p>;
}

export function CounterpartyForm() {
  const [state, formAction, isPending] = useActionState<
    CreateCounterpartyState,
    FormData
  >(createCounterparty, null);

  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {/* Form-level error */}
      {errors.form && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className={labelClass}>
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Acme Capital"
          className={cn(inputClass, errors.name && "border-red-300 focus:border-red-400 focus:ring-red-100")}
        />
        <FieldError message={errors.name} />
      </div>

      {/* Type + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="type" className={labelClass}>
            Type <span className="text-red-500">*</span>
          </label>
          <select
            id="type"
            name="type"
            defaultValue=""
            className={cn(inputClass, errors.type && "border-red-300 focus:border-red-400 focus:ring-red-100")}
          >
            <option value="" disabled>
              Select type…
            </option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.type} />
        </div>

        <div>
          <label htmlFor="status" className={labelClass}>
            Status <span className="text-red-500">*</span>
          </label>
          <select
            id="status"
            name="status"
            defaultValue="ACTIVE"
            className={cn(inputClass, errors.status && "border-red-300 focus:border-red-400 focus:ring-red-100")}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.status} />
        </div>
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website" className={labelClass}>
          Website
        </label>
        <input
          id="website"
          name="website"
          type="url"
          placeholder="https://example.com"
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Brief notes about this counterparty…"
          className={cn(inputClass, "resize-none")}
        />
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className={labelClass}>
          Tags
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          placeholder="e.g. VC, B2B, SaaS"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-zinc-400">Separate tags with commas.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/counterparties"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ size: "sm" })}
        >
          {isPending ? "Creating…" : "Create counterparty"}
        </button>
      </div>
    </form>
  );
}
