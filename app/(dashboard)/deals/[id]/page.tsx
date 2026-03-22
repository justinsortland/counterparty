import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import type { DealStage } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getDeal(id: string, workspaceId: string) {
  return db.deal.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      name: true,
      type: true,
      stage: true,
      value: true,
      currency: true,
      nextFollowUpAt: true,
      createdAt: true,
      updatedAt: true,
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatValue(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-3 border-b border-zinc-100 last:border-0">
      <span className="w-32 shrink-0 text-sm text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-900">{children}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-medium text-zinc-700">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <Section title={title}>
      <p className="py-6 text-sm text-zinc-400">No {title.toLowerCase()} yet.</p>
    </Section>
  );
}

function NotFound() {
  return (
    <div className="p-8">
      <Link href="/deals" className="text-sm text-zinc-400 hover:text-zinc-600">
        ← Deals
      </Link>
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-sm font-medium text-zinc-900">Deal not found</p>
        <p className="mt-1 text-sm text-zinc-500">
          This deal doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/deals"
          className="mt-4 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
        >
          View all deals
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { id } = await params;
  const workspaceId = await getWorkspaceId(user.id);
  const deal = await getDeal(id, workspaceId);

  if (!deal) return <NotFound />;

  const isOverdue =
    deal.nextFollowUpAt !== null && deal.nextFollowUpAt < new Date();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/deals" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Deals
        </Link>
        <div className="mt-2 flex items-center gap-2.5">
          <h1 className="text-lg font-semibold text-zinc-900">{deal.name}</h1>
          <StageBadge stage={deal.stage} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          <Link
            href={`/counterparties/${deal.counterparty.id}`}
            className="hover:text-zinc-700 hover:underline underline-offset-4"
          >
            {deal.counterparty.name}
          </Link>
        </p>
      </div>

      {/* Detail sections */}
      <div className="flex flex-col gap-4 max-w-2xl">
        <Section title="Details">
          <DetailRow label="Counterparty">
            <Link
              href={`/counterparties/${deal.counterparty.id}`}
              className="text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
            >
              {deal.counterparty.name}
            </Link>
          </DetailRow>

          <DetailRow label="Type">
            {deal.type ? (
              deal.type
            ) : (
              <span className="text-zinc-300">—</span>
            )}
          </DetailRow>

          <DetailRow label="Stage">
            <StageBadge stage={deal.stage} />
          </DetailRow>

          <DetailRow label="Value">
            {formatValue(deal.value, deal.currency)}
          </DetailRow>

          <DetailRow label="Currency">
            {deal.currency ?? <span className="text-zinc-300">—</span>}
          </DetailRow>

          <DetailRow label="Follow-up">
            {deal.nextFollowUpAt ? (
              <span className={isOverdue ? "text-amber-600" : undefined}>
                {formatDate(deal.nextFollowUpAt)}
              </span>
            ) : (
              <span className="text-zinc-300">—</span>
            )}
          </DetailRow>

          <DetailRow label="Added">{formatDate(deal.createdAt)}</DetailRow>
          <DetailRow label="Updated">{formatDate(deal.updatedAt)}</DetailRow>
        </Section>

        <PlaceholderSection title="Notes" />
        <PlaceholderSection title="Tasks" />
      </div>
    </div>
  );
}
