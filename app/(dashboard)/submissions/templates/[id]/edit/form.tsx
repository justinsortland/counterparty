"use client";

import { useActionState, Fragment } from "react";
import Link from "next/link";
import { updateTemplate, type UpdateTemplateState } from "@/lib/actions/template";
import { buttonVariants } from "@/lib/button-variants";
import { SubmissionFields, inputClass, labelClass } from "../../../_components/submission-fields";
import { cn } from "@/lib/utils";
import type { PermitType, ProjectType } from "@prisma/client";

type TemplateValues = {
  id: string;
  name: string;
  address: string;
  jurisdiction: string;
  permitType: PermitType;
  projectType: ProjectType;
  scopeOfWork: string;
  reviewContext?: string | null;
};

export function EditTemplateForm({ template, returnTo }: { template: TemplateValues; returnTo?: string }) {
  const [state, formAction, isPending] = useActionState<UpdateTemplateState, FormData>(
    updateTemplate,
    null
  );

  const errors = state?.errors ?? {};
  const displayValues = state?.values ?? template;
  const fieldsKey = JSON.stringify(displayValues);

  return (
    <form action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="templateId" value={template.id} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      {errors.form && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}

      <Fragment key={fieldsKey}>
        {/* Name */}
        <div>
          <label htmlFor="name" className={labelClass}>
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={displayValues.name}
            placeholder="e.g. Standard ADU – San Francisco"
            className={cn(
              inputClass,
              errors.name && "border-red-300 focus:border-red-400 focus:ring-red-100"
            )}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
          )}
        </div>

        <SubmissionFields
          hideTitle
          defaultValues={{
            address: displayValues.address,
            jurisdiction: displayValues.jurisdiction,
            permitType: displayValues.permitType,
            projectType: displayValues.projectType,
            scopeOfWork: displayValues.scopeOfWork,
            reviewContext: displayValues.reviewContext,
          }}
          errors={errors}
        />
      </Fragment>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={returnTo ?? "/submissions/templates"}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ size: "sm" })}
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
