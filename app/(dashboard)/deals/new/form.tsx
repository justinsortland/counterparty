"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDeal, type CreateDealState } from "./actions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

const STAGE_OPTIONS = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE", label: "Active" },
  { value: "DILIGENCE", label: "Diligence" },
  { value: "CLOSED_WON", label: "Closed Won" },
  { value: "CLOSED_LOST", label: "Closed Lost" },
  { value: "PAUSED", label: "Paused" },
];

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 bg-white placeholder:text-zinc-400";

const labelClass = "block text-sm font-medium text-zinc-700 mb-1";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

type Counterparty = { id: string; name: string };

export function DealForm({
  counterparties,
}: {
  counterparties: Counterparty[];
}) {
  const [state, formAction, isPending] = useActionState<
    CreateDealState,
    FormData
  >(createDeal, null);

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
          placeholder="e.g. Series A Investment"
          className={cn(
            inputClass,
            errors.name && "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        />
        <FieldError message={errors.name} />
      </div>

      {/* Counterparty */}
      <div>
        <label htmlFor="counterpartyId" className={labelClass}>
          Counterparty <span className="text-red-500">*</span>
        </label>
        <select
          id="counterpartyId"
          name="counterpartyId"
          defaultValue=""
          className={cn(
            inputClass,
            errors.counterpartyId &&
              "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        >
          <option value="" disabled>
            Select counterparty…
          </option>
          {counterparties.map((cp) => (
            <option key={cp.id} value={cp.id}>
              {cp.name}
            </option>
          ))}
        </select>
        <FieldError message={errors.counterpartyId} />
      </div>

      {/* Type + Stage */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="type" className={labelClass}>
            Type
          </label>
          <input
            id="type"
            name="type"
            type="text"
            placeholder="e.g. Investment, Vendor"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="stage" className={labelClass}>
            Stage <span className="text-red-500">*</span>
          </label>
          <select
            id="stage"
            name="stage"
            defaultValue="PROSPECT"
            className={cn(
              inputClass,
              errors.stage &&
                "border-red-300 focus:border-red-400 focus:ring-red-100"
            )}
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.stage} />
        </div>
      </div>

      {/* Value + Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="value" className={labelClass}>
            Value
          </label>
          <input
            id="value"
            name="value"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 500000"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="currency" className={labelClass}>
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            type="text"
            defaultValue="USD"
            placeholder="USD"
            maxLength={3}
            className={inputClass}
          />
        </div>
      </div>

      {/* Follow-up date */}
      <div>
        <label htmlFor="nextFollowUpAt" className={labelClass}>
          Follow-up Date
        </label>
        <input
          id="nextFollowUpAt"
          name="nextFollowUpAt"
          type="date"
          className={inputClass}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/deals"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ size: "sm" })}
        >
          {isPending ? "Creating…" : "Create deal"}
        </button>
      </div>
    </form>
  );
}
