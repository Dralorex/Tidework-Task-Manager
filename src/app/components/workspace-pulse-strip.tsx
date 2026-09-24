import Link from "next/link";

export function WorkspacePulseStrip({
  workspaceId,
  counts,
  canReview,
  inbox,
  myClaimedCount,
  needsReviewCount,
}: {
  workspaceId: string;
  counts: {
    open: number;
    claimed: number;
    inReview: number;
    overdue: number;
    done: number;
  } | null;
  canReview: boolean;
  inbox: "mine" | "review" | null;
  myClaimedCount: number;
  needsReviewCount: number;
}) {
  const base = `/app/w/${workspaceId}`;
  const tab = (
    href: string,
    active: boolean,
    label: string,
    count?: number,
  ) => (
    <Link
      href={href}
      className={`inline-flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[#0A3D45] text-[#E8F7F6]"
          : "bg-white/50 text-[#0A3D45]/75 hover:bg-white/80"
      }`}
    >
      {label}
      {typeof count === "number" ? (
        <span className="ml-1.5 tabular-nums opacity-80">{count}</span>
      ) : null}
    </Link>
  );

  return (
    <div className="mt-6 space-y-3">
      {counts ? (
        <div className="tide-panel p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45] sm:text-xl">
                Workspace pulse
              </h2>
              <p className="text-xs text-[#0A3D45]/55 sm:text-sm">
                Claim / review health at a glance
              </p>
            </div>
            {canReview && counts.inReview > 0 ? (
              <Link
                href={`${base}?inbox=review`}
                className="tide-btn-secondary min-h-10 text-sm"
              >
                Needs your review · {counts.inReview}
              </Link>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ["Open", counts.open],
                ["Claimed", counts.claimed],
                ["In review", counts.inReview],
                ["Overdue", counts.overdue],
                ["Done", counts.done],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-[#0A3D45]/5 px-3 py-2 text-center"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#0A3D45]/55">
                  {label}
                </dt>
                <dd className="mt-0.5 font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tab(base, inbox === null, "Folders")}
        {tab(`${base}?inbox=mine`, inbox === "mine", "My claimed", myClaimedCount)}
        {canReview
          ? tab(
              `${base}?inbox=review`,
              inbox === "review",
              "Needs review",
              needsReviewCount,
            )
          : null}
      </div>
    </div>
  );
}
