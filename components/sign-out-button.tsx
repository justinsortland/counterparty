"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full rounded-md px-3 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
    >
      Sign out
    </button>
  );
}
