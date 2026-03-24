import { cn } from "@/lib/utils";

export const PERMIT_TYPE_OPTIONS = [
  { value: "BUILDING", label: "Building" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "MECHANICAL", label: "Mechanical (HVAC)" },
  { value: "ZONING", label: "Zoning / Land Use" },
  { value: "GRADING", label: "Grading / Drainage" },
];

export const PROJECT_TYPE_OPTIONS = [
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

export const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 bg-white placeholder:text-zinc-400";

export const labelClass = "block text-sm font-medium text-zinc-700 mb-1";

export type SubmissionFieldErrors = Partial<
  Record<
    | "title"
    | "address"
    | "jurisdiction"
    | "permitType"
    | "projectType"
    | "scopeOfWork",
    string
  >
>;

export type SubmissionDefaultValues = {
  title?: string;
  address?: string;
  jurisdiction?: string;
  permitType?: string;
  projectType?: string;
  scopeOfWork?: string;
  reviewContext?: string | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function SubmissionFields({
  defaultValues,
  errors,
}: {
  defaultValues?: SubmissionDefaultValues;
  errors?: SubmissionFieldErrors;
}) {
  const e = errors ?? {};
  const d = defaultValues ?? {};

  return (
    <>
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
          defaultValue={d.title}
          placeholder="e.g. Kitchen remodel at 123 Main St"
          className={cn(
            inputClass,
            e.title && "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        />
        <FieldError message={e.title} />
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
          defaultValue={d.address}
          placeholder="e.g. 123 Main St, San Francisco, CA 94105"
          className={cn(
            inputClass,
            e.address &&
              "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        />
        <FieldError message={e.address} />
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
          defaultValue={d.jurisdiction}
          placeholder="e.g. San Francisco, CA"
          className={cn(
            inputClass,
            e.jurisdiction &&
              "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        />
        <FieldError message={e.jurisdiction} />
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
            defaultValue={d.permitType ?? ""}
            className={cn(
              inputClass,
              e.permitType &&
                "border-red-300 focus:border-red-400 focus:ring-red-100"
            )}
          >
            <option value="" disabled>
              Select permit type…
            </option>
            {PERMIT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={e.permitType} />
        </div>

        <div>
          <label htmlFor="projectType" className={labelClass}>
            Project Type <span className="text-red-500">*</span>
          </label>
          <select
            id="projectType"
            name="projectType"
            defaultValue={d.projectType ?? ""}
            className={cn(
              inputClass,
              e.projectType &&
                "border-red-300 focus:border-red-400 focus:ring-red-100"
            )}
          >
            <option value="" disabled>
              Select project type…
            </option>
            {PROJECT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={e.projectType} />
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
          defaultValue={d.scopeOfWork}
          placeholder="Describe all proposed work in detail. Include dimensions, materials, structural changes, and anything that touches electrical, plumbing, or mechanical systems."
          className={cn(
            inputClass,
            "resize-y",
            e.scopeOfWork &&
              "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        />
        <FieldError message={e.scopeOfWork} />
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
          defaultValue={d.reviewContext ?? ""}
          placeholder="Any prior objections, special concerns, or focus areas for the reviewer."
          className={cn(inputClass, "resize-y")}
        />
        <p className="mt-1 text-xs text-zinc-400">
          Use this to flag known issues or guide the AI reviewer&apos;s focus.
        </p>
      </div>
    </>
  );
}
