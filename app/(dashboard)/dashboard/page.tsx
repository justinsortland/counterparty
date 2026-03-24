// Temporary stub — will be rewritten in Phase 3 with real submission stats.

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Dashboard</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active submissions" },
          { label: "Needs revision" },
          { label: "Critical issues" },
        ].map(({ label }) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white px-5 py-4"
          >
            <p className="text-2xl font-semibold tabular-nums text-zinc-900">0</p>
            <p className="mt-0.5 text-sm text-zinc-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
