"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUrgencyChipPrefsAction } from "@/app/actions/workspaces";
import { ChatSidebarSection } from "@/app/components/chat-sidebar-section";

export function UrgencyChipSettings({
  workspaceId,
  showBase,
  showDate,
  showTotal,
  canManage,
}: {
  workspaceId: string;
  showBase: boolean;
  showDate: boolean;
  showTotal: boolean;
  canManage: boolean;
}) {
  const [base, setBase] = useState(showBase);
  const [date, setDate] = useState(showDate);
  const [total, setTotal] = useState(showTotal);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canManage) return null;

  function save(next: { base: boolean; date: boolean; total: boolean }) {
    setError(null);
    setBase(next.base);
    setDate(next.date);
    setTotal(next.total);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("showUrgencyBase", next.base ? "1" : "0");
      fd.set("showUrgencyDate", next.date ? "1" : "0");
      fd.set("showUrgencyTotal", next.total ? "1" : "0");
      const result = await updateUrgencyChipPrefsAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        setBase(showBase);
        setDate(showDate);
        setTotal(showTotal);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="tide-panel p-4">
      <ChatSidebarSection
        title="Urgency chips"
        description="Choose which priority chips appear on task rows. Total is base + due-date pressure."
      >
        <ul className="space-y-2 text-sm text-[color:var(--tide-deep)]">
          <li>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={base}
                disabled={pending}
                onChange={(e) =>
                  save({ base: e.target.checked, date, total })
                }
              />
              <span>
                Base
                <span className="mt-0.5 block text-[11px] text-[color:var(--tide-deep)]/50">
                  Manual priority weight (1–10)
                </span>
              </span>
            </label>
          </li>
          <li>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={date}
                disabled={pending}
                onChange={(e) =>
                  save({ base, date: e.target.checked, total })
                }
              />
              <span>
                Date
                <span className="mt-0.5 block text-[11px] text-[color:var(--tide-deep)]/50">
                  Due-date pressure (0–5)
                </span>
              </span>
            </label>
          </li>
          <li>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={total}
                disabled={pending}
                onChange={(e) =>
                  save({ base, date, total: e.target.checked })
                }
              />
              <span>
                Total
                <span className="mt-0.5 block text-[11px] text-[color:var(--tide-deep)]/50">
                  Combined urgency label + score
                </span>
              </span>
            </label>
          </li>
        </ul>
        {error ? (
          <p className="mt-2 text-xs text-[color:var(--tide-coral)]">{error}</p>
        ) : null}
      </ChatSidebarSection>
    </div>
  );
}
