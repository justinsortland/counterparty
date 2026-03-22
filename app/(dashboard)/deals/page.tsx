import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import type { DealStage } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getDeals(workspaceId: string) {
  return db.deal.findMany({
    where: { workspaceId },
    orderBy: [
      { nextFollowUpAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      name: true,
      type: true,
      stage: true,
      value: true,
      currency: true,
      nextFollowUpAt: true,
      counterparty: {
        select: { id: true, name: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<DealStage, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  DILIGENCE: "Diligence",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
  PAUSED: "Paused",
};

const STAGE_STYLES: Record<DealStage, string> = {
  PROSPECT: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  DILIGENCE: "bg-amber-50 text-amber-700",
  CLOSED_WON: "bg-emerald-50 text-emerald-700",
  CLOSED_LOST: "bg-zinc-100 text-zinc-500",
  PAUSED: "bg-orange-50 text-orange-700",
};

function formatValue(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[stage]}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function FollowUpCell({ date }: { date: Date | null }) {
  if (!date) return <span className="text-zinc-300">—</span>;
  const overdue = date < new Date();
  return (
    <span className={overdue ? "text-amber-600" : "text-zinc-500"}>
      {formatDate(date)}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-20 text-center">
      <p className="text-sm font-medium text-zinc-900">No deals yet</p>
      <p className="mt-1 text-sm text-zinc-500">
        Track your first deal to get started.
      </p>
      <div className="mt-4">
        <Link href="/deals/new" className={buttonVariants({ size: "sm" })}>
          + New Deal
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DealsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const deals = await getDeals(workspaceId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Deals</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {deals.length === 0
              ? "No deals"
              : `${deals.length} deal${deals.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href="/deals/new" className={buttonVariants({ size: "sm" })}>
          + New Deal
        </Link>
      </div>

      {/* Content */}
      {deals.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                {["Name", "Counterparty", "Type", "Stage", "Value", "Follow-up"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {deals.map((deal) => (
                <tr key={deal.id} className="transition-colors hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-600"
                    >
                      {deal.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/counterparties/${deal.counterparty.id}`}
                      className="text-zinc-600 hover:text-zinc-900 hover:underline underline-offset-4"
                    >
                      {deal.counterparty.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {deal.type ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={deal.stage} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatValue(deal.value, deal.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <FollowUpCell date={deal.nextFollowUpAt} />
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
