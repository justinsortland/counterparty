import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">Signed in as {user.email}</p>
    </div>
  );
}
