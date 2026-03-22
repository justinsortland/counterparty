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

async function getContacts(counterpartyId: string, workspaceId: string) {
  return db.contact.findMany({
    where: { counterpartyId, workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      title: true,
      email: true,
      phone: true,
      linkedinUrl: true,
    },
  });
}

async function getCounterparty(id: string, workspaceId: string) {
  return db.counterparty.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      website: true,
      description: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-medium text-zinc-700">{title}</h2>
        {action}
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

type Contact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
};

function ContactsSection({
  contacts,
  counterpartyId,
}: {
  contacts: Contact[];
  counterpartyId: string;
}) {
  return (
    <Section
      title="Contacts"
      action={
        <Link
          href={`/counterparties/${counterpartyId}/contacts/new`}
          className={buttonVariants({ variant: "outline", size: "xs" })}
        >
          + Add contact
        </Link>
      }
    >
      {contacts.length === 0 ? (
        <p className="py-6 text-sm text-zinc-400">No contacts yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                Name
              </th>
              <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                Title
              </th>
              <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                Email
              </th>
              <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                Phone
              </th>
              <th className="py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                LinkedIn
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {contacts.map((c) => (
              <tr key={c.id}>
                <td className="py-3 pr-4 font-medium text-zinc-900">{c.name}</td>
                <td className="py-3 pr-4 text-zinc-500">
                  {c.title ?? <span className="text-zinc-300">—</span>}
                </td>
                <td className="py-3 pr-4">
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="text-zinc-600 hover:text-zinc-900 hover:underline underline-offset-4"
                    >
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-zinc-500">
                  {c.phone ?? <span className="text-zinc-300">—</span>}
                </td>
                <td className="py-3">
                  {c.linkedinUrl ? (
                    <a
                      href={c.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-600 hover:text-zinc-900 hover:underline underline-offset-4"
                    >
                      LinkedIn ↗
                    </a>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <Section title={title}>
      <p className="py-6 text-sm text-zinc-400">No {title.toLowerCase()} yet.</p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

function NotFound() {
  return (
    <div className="p-8">
      <Link href="/counterparties" className="text-sm text-zinc-400 hover:text-zinc-600">
        ← Counterparties
      </Link>
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-sm font-medium text-zinc-900">Counterparty not found</p>
        <p className="mt-1 text-sm text-zinc-500">
          This counterparty doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/counterparties"
          className="mt-4 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
        >
          View all counterparties
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CounterpartyDetailPage({
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
  const [counterparty, contacts] = await Promise.all([
    getCounterparty(id, workspaceId),
    getContacts(id, workspaceId),
  ]);

  if (!counterparty) return <NotFound />;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/counterparties" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Counterparties
        </Link>
        <div className="mt-2 flex items-center gap-2.5">
          <h1 className="text-lg font-semibold text-zinc-900">{counterparty.name}</h1>
          <StatusBadge status={counterparty.status} />
        </div>
        <div className="mt-1.5">
          <TypeBadge type={counterparty.type} />
        </div>
      </div>

      {/* Detail sections */}
      <div className="flex flex-col gap-4 max-w-2xl">
        {/* Details */}
        <Section title="Details">
          <DetailRow label="Website">
            {counterparty.website ? (
              <a
                href={counterparty.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
              >
                {counterparty.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-zinc-300">—</span>
            )}
          </DetailRow>

          <DetailRow label="Description">
            {counterparty.description ? (
              <span className="whitespace-pre-wrap">{counterparty.description}</span>
            ) : (
              <span className="text-zinc-300">—</span>
            )}
          </DetailRow>

          <DetailRow label="Tags">
            {counterparty.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {counterparty.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-zinc-300">—</span>
            )}
          </DetailRow>

          <DetailRow label="Added">{formatDate(counterparty.createdAt)}</DetailRow>
          <DetailRow label="Updated">{formatDate(counterparty.updatedAt)}</DetailRow>
        </Section>

        {/* Contacts */}
        <ContactsSection contacts={contacts} counterpartyId={id} />

        {/* Deals — placeholder until Phase 2 */}
        <PlaceholderSection title="Deals" />
      </div>
    </div>
  );
}
