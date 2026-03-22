import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { ContactForm } from "./form";

async function getCounterparty(id: string, workspaceId: string) {
  return db.counterparty.findFirst({
    where: { id, workspaceId },
    select: { id: true, name: true },
  });
}

export default async function NewContactPage({
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
  const counterparty = await getCounterparty(id, workspaceId);

  if (!counterparty) {
    return (
      <div className="p-8">
        <Link
          href="/counterparties"
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Counterparties
        </Link>
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-sm font-medium text-zinc-900">
            Counterparty not found
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

  const backHref = `/counterparties/${id}`;

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={backHref} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← {counterparty.name}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Add Contact
        </h1>
      </div>

      <div className="max-w-xl">
        <ContactForm counterpartyId={id} cancelHref={backHref} />
      </div>
    </div>
  );
}
