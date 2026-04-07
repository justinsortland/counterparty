"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PermitType, ProjectType } from "@prisma/client";
import { deleteTemplates, duplicateTemplate } from "@/lib/actions/template";
import { DeleteTemplateButton } from "./delete-template-button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateRow = {
  id: string;
  name: string;
  permitType: PermitType;
  projectType: ProjectType;
  createdAt: string; // ISO string — serialized from server component
};

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  BUILDING: "Building",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  MECHANICAL: "Mechanical (HVAC)",
  ZONING: "Zoning / Land Use",
  GRADING: "Grading / Drainage",
};

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  REMODEL: "Kitchen or Bath Remodel",
  ADDITION: "Room Addition",
  ADU: "ADU",
  NEW_CONSTRUCTION: "New Construction",
  DECK_PATIO: "Deck or Patio",
  FENCE_WALL: "Fence or Retaining Wall",
  POOL: "Pool or Spa",
  DEMOLITION: "Demolition",
  OTHER: "Other",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const TH = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
const TD = "px-4 py-3 text-sm";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatesTable({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeletingIds, setBulkDeletingIds] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = templates.length > 0 && selectedIds.size === templates.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const isBulkDeleting = bulkDeletingIds.size > 0;

  // Clear selection and bulk-deleting state when the templates list changes
  // (filter applied, or router.refresh() completes after bulk delete).
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkDeletingIds(new Set());
  }, [templates]);

  // Drive the indeterminate state — cannot be set via JSX prop
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(templates.map((t) => t.id)));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} template${count === 1 ? "" : "s"}? This cannot be undone.`))
      return;
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    setBulkDeletingIds(new Set(ids));
    try {
      await deleteTemplates(ids);
      router.refresh();
    } catch {
      setBulkDeletingIds(new Set());
    }
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <span className="text-sm text-zinc-600">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBulkDeleting
              ? "Deleting…"
              : `Delete ${selectedIds.size} template${selectedIds.size === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-600"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-2.5 w-8">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                  aria-label="Select all"
                />
              </th>
              <th className={TH}>Name</th>
              <th className={TH}>Permit Type</th>
              <th className={TH}>Project Type</th>
              <th className={TH}>Saved</th>
              <th className={TH}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {templates.map((t) => (
              <tr
                key={t.id}
                className={`transition-colors hover:bg-zinc-50 ${
                  selectedIds.has(t.id) ? "bg-zinc-50" : ""
                }`}
              >
                <td className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleRow(t.id)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    aria-label={`Select ${t.name}`}
                  />
                </td>
                <td className={`${TD} font-medium text-zinc-900`}>{t.name}</td>
                <td className={TD}>
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {PERMIT_TYPE_LABELS[t.permitType]}
                  </span>
                </td>
                <td className={`${TD} text-zinc-500`}>
                  {PROJECT_TYPE_LABELS[t.projectType]}
                </td>
                <td className={`${TD} text-zinc-400`}>{formatDate(t.createdAt)}</td>
                <td className={`${TD} text-right`}>
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/submissions/new?template=${t.id}`}
                      className="text-sm text-zinc-500 hover:text-zinc-700"
                    >
                      Use
                    </Link>
                    <form action={duplicateTemplate}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <button
                        type="submit"
                        className="text-sm text-zinc-500 hover:text-zinc-700"
                      >
                        Duplicate
                      </button>
                    </form>
                    <Link
                      href={`/submissions/templates/${t.id}/edit`}
                      className="text-sm text-zinc-500 hover:text-zinc-700"
                    >
                      Edit
                    </Link>
                    <DeleteTemplateButton
                      templateId={t.id}
                      templateName={t.name}
                      externalDeleting={bulkDeletingIds.has(t.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
