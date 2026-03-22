import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import type { CounterpartyStatus, CounterpartyType, DealStage } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CLOSED_STAGES: DealStage[] = ["CLOSED_WON", "CLOSED_LOST"];

async function getDashboardData(workspaceId: string) {
  const now = new Date();

  const [
    openDealsCount,
    overdueCount,
    counterpartyCount,
    recentCounterparties,
    followUpDeals,
  ] = await Promise.all([
    db.deal.count({
      where: { workspaceId, stage: { notIn: CLOSED_STAGES } },
    }),
    db.deal.count({
      where: { workspaceId, nextFollowUpAt: { lt: now } },
    }),
    db.counterparty.count({
      where: { workspaceId },
    }),
    db.counterparty.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, status: true },
    }),
    db.deal.findMany({
      where: {
        workspaceId,
        nextFollowUpAt: { not: null },
        stage: { notIn: CLOSED_STAGES },
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        stage: true,
        nextFollowUpAt: true,
        counterparty: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    openDealsCount,
    overdueCount,
    counterpartyCount,
    recentCounterparties,
    followUpDeals,
  };
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

const CP_TYPE_LABELS: Record<CounterpartyType, string> = {
  COMPANY: "Company",
  FUND: "Fund",
  VENDOR: "Vendor",
  CLIENT: "Client",
  RECRUITER: "Recruiter",
  INDIVIDUAL: "Individual",
};

const CP_STATUS_STYLES: Record<CounterpartyStatus, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  WATCH: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-zinc-100 text-zinc-500",
};

const CP_STATUS_LABELS: Record<CounterpartyStatus, string> = {
  ACTIVE: "Active",
  WATCH: "Watch",
  INACTIVE: "Inactive",
};

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

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <p
        className={`text-2xl font-semibold tabular-nums ${
          alert && value > 0 ? "text-amber-600" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-sm text-zinc-500">{label}</p>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-medium text-zinc-700">{title}</h2>
      <Link
        href={href}
        className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline underline-offset-4"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}

function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[stage]}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function StatusBadge({ status }: { status: CounterpartyStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CP_STATUS_STYLES[status]}`}
    >
      {CP_STATUS_LABELS[status]}
    </span>
  );
}

const TH =
  "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
const TD = "px-4 py-3 text-sm";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const {
    openDealsCount,
    overdueCount,
    counterpartyCount,
    recentCounterparties,
    followUpDeals,
  } = await getDashboardData(workspaceId);

  const now = new Date();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="Open deals" value={openDealsCount} />
        <StatCard label="Overdue follow-ups" value={overdueCount} alert />
        <StatCard label="Counterparties" value={counterpartyCount} />
      </div>

      {/* Recent counterparties */}
      <div className="mb-8">
        <SectionHeader
          title="Recent Counterparties"
          href="/counterparties"
          linkLabel="View all"
        />
        {recentCounterparties.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 py-8 text-center">
            <p className="text-sm text-zinc-400">No counterparties yet.</p>
            <Link
              href="/counterparties/new"
              className="mt-2 inline-block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
            >
              Add your first counterparty
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className={TH}>Name</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {recentCounterparties.map((cp) => (
                  <tr key={cp.id} className="transition-colors hover:bg-zinc-50">
                    <td className={TD}>
                      <Link
                        href={`/counterparties/${cp.id}`}
                        className="font-medium text-zinc-900 hover:text-zinc-600"
                      >
                        {cp.name}
                      </Link>
                    </td>
                    <td className={TD}>
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {CP_TYPE_LABELS[cp.type]}
                      </span>
                    </td>
                    <td className={TD}>
                      <StatusBadge status={cp.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deals by follow-up */}
      <div>
        <SectionHeader
          title="Deals by Follow-up"
          href="/deals"
          linkLabel="View all"
        />
        {followUpDeals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 py-8 text-center">
            <p className="text-sm text-zinc-400">
              No deals with follow-up dates set.
            </p>
            <Link
              href="/deals/new"
              className="mt-2 inline-block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
            >
              Create a deal
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className={TH}>Deal</th>
                  <th className={TH}>Counterparty</th>
                  <th className={TH}>Stage</th>
                  <th className={TH}>Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {followUpDeals.map((deal) => {
                  const overdue =
                    deal.nextFollowUpAt !== null &&
                    deal.nextFollowUpAt < now;
                  return (
                    <tr
                      key={deal.id}
                      className="transition-colors hover:bg-zinc-50"
                    >
                      <td className={TD}>
                        <Link
                          href={`/deals/${deal.id}`}
                          className="font-medium text-zinc-900 hover:text-zinc-600"
                        >
                          {deal.name}
                        </Link>
                      </td>
                      <td className={TD}>
                        <Link
                          href={`/counterparties/${deal.counterparty.id}`}
                          className="text-zinc-600 hover:text-zinc-900 hover:underline underline-offset-4"
                        >
                          {deal.counterparty.name}
                        </Link>
                      </td>
                      <td className={TD}>
                        <StageBadge stage={deal.stage} />
                      </td>
                      <td className={`${TD} ${overdue ? "text-amber-600" : "text-zinc-500"}`}>
                        {deal.nextFollowUpAt
                          ? formatDate(deal.nextFollowUpAt)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
