"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createContact, type CreateContactState } from "./actions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 bg-white placeholder:text-zinc-400";

const labelClass = "block text-sm font-medium text-zinc-700 mb-1";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function ContactForm({
  counterpartyId,
  cancelHref,
}: {
  counterpartyId: string;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState<
    CreateContactState,
    FormData
  >(createContact, null);

  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden counterpartyId */}
      <input type="hidden" name="counterpartyId" value={counterpartyId} />

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
          placeholder="e.g. Jane Smith"
          className={cn(
            inputClass,
            errors.name && "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        />
        <FieldError message={errors.name} />
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="e.g. Partner, CFO"
          className={inputClass}
        />
      </div>

      {/* Email + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="jane@example.com"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            className={inputClass}
          />
        </div>
      </div>

      {/* LinkedIn URL */}
      <div>
        <label htmlFor="linkedinUrl" className={labelClass}>
          LinkedIn URL
        </label>
        <input
          id="linkedinUrl"
          name="linkedinUrl"
          type="url"
          placeholder="https://linkedin.com/in/janesmith"
          className={inputClass}
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Any context about this contact…"
          className={cn(inputClass, "resize-none")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ size: "sm" })}
        >
          {isPending ? "Adding…" : "Add contact"}
        </button>
      </div>
    </form>
  );
}
