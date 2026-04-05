"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteSubmissions } from "@/lib/actions/submission";
import { DeleteButton } from "./delete-button";
import { DuplicateButton } from "./duplicate-button";
import type { PermitType, ProjectType, SubmissionStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubmissionRow = {
  id: string;
  title: string;
  address: string;
  permitType: PermitType;
  projectType: ProjectType;
  status: SubmissionStatus;
  updatedAt: string; // ISO string — serialized from server component
};

// ---------------------------------------------------------------------------
// Label / style maps
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

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  REVIEWED: "bg-green-50 text-green-700",
  NEEDS_REVISION: "bg-amber-50 text-amber-700",
};

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Reviewed",
  NEEDS_REVISION: "Needs Revision",
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

export function SubmissionsTable({
  submissions,
  returnTo,
}: {
  submissions: SubmissionRow[];
  returnTo: string;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = submissions.length > 0 && selectedIds.size === submissions.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // Clear selection when the submissions list changes (filter applied or list refreshed)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [submissions]);

  // Drive the indeterminate state — cannot be set via JSX prop
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(submissions.map((s) => s.id)));
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
    if (
      !confirm(
        `Delete ${count} submission${count === 1 ? "" : "s"}? This cannot be undone.`
      )
    )
      return;

    // Clear immediately so the UI does not show stale selection while the
    // network round-trip and subsequent router.refresh() are in flight.
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    setIsBulkDeleting(true);
    try {
      await deleteSubmissions(ids);
      router.refresh();
    } finally {
      setIsBulkDeleting(false);
    }
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <span className="text-sm text-zinc-600">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBulkDeleting
              ? "Deleting…"
              : `Delete ${selectedIds.size} submission${selectedIds.size === 1 ? "" : "s"}`}
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
              <th className={TH}>Title</th>
              <th className={TH}>Permit Type</th>
              <th className={TH}>Project Type</th>
              <th className={TH}>Status</th>
              <th className={TH}>Updated</th>
              <th className={TH}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {submissions.map((s) => (
              <tr
                key={s.id}
                className={`transition-colors hover:bg-zinc-50 ${
                  selectedIds.has(s.id) ? "bg-zinc-50" : ""
                }`}
              >
                <td className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleRow(s.id)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    aria-label={`Select ${s.title}`}
                  />
                </td>
                <td className={TD}>
                  <Link
                    href={`/submissions/${s.id}`}
                    className="font-medium text-zinc-900 hover:text-zinc-600"
                  >
                    {s.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-400">{s.address}</p>
                </td>
                <td className={TD}>
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {PERMIT_TYPE_LABELS[s.permitType]}
                  </span>
                </td>
                <td className={TD}>
                  <span className="text-zinc-500">
                    {PROJECT_TYPE_LABELS[s.projectType]}
                  </span>
                </td>
                <td className={TD}>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}
                  >
                    {STATUS_LABELS[s.status]}
                  </span>
                </td>
                <td className={`${TD} text-zinc-400`}>
                  {formatDate(s.updatedAt)}
                </td>
                <td className={`${TD} text-right`}>
                  <div className="flex items-center justify-end gap-3">
                    <DuplicateButton submissionId={s.id} />
                    <DeleteButton submissionId={s.id} title={s.title} returnTo={returnTo} />
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
