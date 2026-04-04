"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const INPUT_CLS =
  "rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const permitType = searchParams.get("permitType") ?? "";
  const projectType = searchParams.get("projectType") ?? "";

  const hasFilters = !!(q || status || permitType || projectType);

  function applyUpdate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          applyUpdate({ q: ((fd.get("q") as string) ?? "").trim() });
        }}
      >
        <input
          key={q}
          name="q"
          defaultValue={q}
          placeholder="Search by title…"
          className={`${INPUT_CLS} w-52`}
        />
      </form>

      <select
        value={status}
        onChange={(e) => applyUpdate({ status: e.target.value })}
        className={INPUT_CLS}
      >
        <option value="">All statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="REVIEWED">Reviewed</option>
        <option value="NEEDS_REVISION">Needs Revision</option>
      </select>

      <select
        value={permitType}
        onChange={(e) => applyUpdate({ permitType: e.target.value })}
        className={INPUT_CLS}
      >
        <option value="">All permit types</option>
        <option value="BUILDING">Building</option>
        <option value="ELECTRICAL">Electrical</option>
        <option value="PLUMBING">Plumbing</option>
        <option value="MECHANICAL">Mechanical (HVAC)</option>
        <option value="ZONING">Zoning / Land Use</option>
        <option value="GRADING">Grading / Drainage</option>
      </select>

      <select
        value={projectType}
        onChange={(e) => applyUpdate({ projectType: e.target.value })}
        className={INPUT_CLS}
      >
        <option value="">All project types</option>
        <option value="REMODEL">Kitchen or Bath Remodel</option>
        <option value="ADDITION">Room Addition</option>
        <option value="ADU">ADU</option>
        <option value="NEW_CONSTRUCTION">New Construction</option>
        <option value="DECK_PATIO">Deck or Patio</option>
        <option value="FENCE_WALL">Fence or Retaining Wall</option>
        <option value="POOL">Pool or Spa</option>
        <option value="DEMOLITION">Demolition</option>
        <option value="OTHER">Other</option>
      </select>

      {hasFilters && (
        <Link href="/submissions" className="text-sm text-zinc-400 hover:text-zinc-600">
          × Clear
        </Link>
      )}
    </div>
  );
}
