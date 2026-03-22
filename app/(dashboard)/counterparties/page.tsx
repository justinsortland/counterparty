import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import type { CounterpartyStatus, CounterpartyType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getCounterparties(workspaceId: string) {
  return db.counterparty.findMany({
    where: { workspaceId },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      website: true,
      lastActivityAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<CounterpartyType, string> = {
  COMPANY: "Company",
  FUND: "Fund",
  VENDOR: "Vendor",
  CLIENT: "Client",
  RECRUITER: "Recruiter",
  INDIVIDUAL: "Individual",
};

const STATUS_STYLES: Record<CounterpartyStatus, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  WATCH: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-zinc-100 text-zinc-500",
};

const STATUS_LABELS: Record<CounterpartyStatus, string> = {
  ACTIVE: "Active",
  WATCH: "Watch",
  INACTIVE: "Inactive",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: CounterpartyType }) {
  return (
    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
      {TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: CounterpartyStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-20 text-center">
      <p className="text-sm font-medium text-zinc-900">No counterparties yet</p>
      <p className="mt-1 text-sm text-zinc-500">
        Add your first counterparty to get started.
      </p>
      <div className="mt-4">
        <Link href="/counterparties/new" className={buttonVariants({ size: "sm" })}>
          + New Counterparty
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CounterpartiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const counterparties = await getCounterparties(workspaceId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">
            Counterparties
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {counterparties.length === 0
              ? "No counterparties"
              : `${counterparties.length} counterpart${counterparties.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
        <Link href="/counterparties/new" className={buttonVariants({ size: "sm" })}>
          + New Counterparty
        </Link>
      </div>

      {/* Content */}
      {counterparties.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Website
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Last activity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {counterparties.map((cp) => (
                <tr
                  key={cp.id}
                  className="transition-colors hover:bg-zinc-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/counterparties/${cp.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-600"
                    >
                      {cp.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={cp.type} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={cp.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {cp.website ? (
                      <a
                        href={cp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-zinc-900 hover:underline"
                      >
                        {cp.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(cp.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
