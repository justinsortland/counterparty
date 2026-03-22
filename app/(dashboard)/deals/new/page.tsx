import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buttonVariants } from "@/lib/button-variants";
import { DealForm } from "./form";

async function getCounterparties(workspaceId: string) {
  return db.counterparty.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export default async function NewDealPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const counterparties = await getCounterparties(workspaceId);

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/deals" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Deals
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">New Deal</h1>
      </div>

      <div className="max-w-xl">
        {counterparties.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 px-6 py-10 text-center">
            <p className="text-sm font-medium text-zinc-900">
              No counterparties yet
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              You need at least one counterparty before creating a deal.
            </p>
            <div className="mt-4">
              <Link
                href="/counterparties/new"
                className={buttonVariants({ size: "sm" })}
              >
                + New Counterparty
              </Link>
            </div>
          </div>
        ) : (
          <DealForm counterparties={counterparties} />
        )}
      </div>
    </div>
  );
}
