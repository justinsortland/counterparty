import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bootstrapWorkspace } from "@/lib/bootstrap";
import { NavLinks } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await bootstrapWorkspace(user.id, user.email!, user.user_metadata?.name);

  return (
    <div className="flex h-screen overflow-hidden bg-white print:h-auto print:overflow-visible">
      {/* Sidebar */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-zinc-100 bg-white print:hidden">
        {/* Wordmark */}
        <div className="flex h-14 items-center border-b border-zinc-100 px-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            Counterparty
          </span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <NavLinks />
        </div>

        {/* User / sign out */}
        <div className="border-t border-zinc-100 px-3 pt-4 pb-8">
          <p className="truncate px-1 text-xs text-zinc-400 mb-2">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-y-auto print:overflow-visible">
        {children}
      </main>
    </div>
  );
}
