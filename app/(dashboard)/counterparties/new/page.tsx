import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CounterpartyForm } from "./form";

export default async function NewCounterpartyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/counterparties"
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Counterparties
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          New Counterparty
        </h1>
      </div>

      <div className="max-w-xl">
        <CounterpartyForm />
      </div>
    </div>
  );
}
