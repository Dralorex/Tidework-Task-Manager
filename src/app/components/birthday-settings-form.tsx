"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  shareBirthdayWithFriendsAction,
  updateBirthdayAction,
  type BirthdaySaveResult,
} from "@/app/actions/birthday";
import { birthdayParts, formatBirthday } from "@/lib/birthday";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tide-btn-secondary text-sm disabled:opacity-60"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

export function BirthdaySettingsForm({
  birthday,
  shareBirthdayFriends,
  shareBirthdayWorkspaces,
  askBeforeShareBirthday,
}: {
  birthday: Date | string | null;
  shareBirthdayFriends: boolean;
  shareBirthdayWorkspaces: boolean;
  askBeforeShareBirthday: boolean;
}) {
  const router = useRouter();
  const birthdayDate = birthday
    ? typeof birthday === "string"
      ? new Date(birthday)
      : birthday
    : null;
  const parts = birthdayParts(birthdayDate);
  const [state, action] = useActionState(
    updateBirthdayAction,
    null as BirthdaySaveResult | null,
  );
  const [pickerFriends, setPickerFriends] = useState<
    { id: string; label: string }[] | null
  >(null);
  const [shareMode, setShareMode] = useState<"all" | "select" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [shareState, shareAction] = useActionState(
    shareBirthdayWithFriendsAction,
    null,
  );

  useEffect(() => {
    if (
      state &&
      state.ok &&
      "needsFriendPicker" in state &&
      state.needsFriendPicker
    ) {
      setPickerFriends(state.friends);
      setShareMode(null);
      setSelected([]);
    } else if (state && state.ok && !("needsFriendPicker" in state)) {
      setPickerFriends(null);
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (shareState?.ok) {
      setPickerFriends(null);
      setShareMode(null);
      router.refresh();
    }
  }, [shareState, router]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-[#0A3D45]">Birthday</h3>
        <p className="mt-1 text-xs text-[#0A3D45]/60">
          Year is never shown. Sharing stays under your control.
        </p>
        {birthdayDate ? (
          <p className="mt-2 text-sm text-[#0A3D45]/75">
            Saved as <strong>{formatBirthday(birthdayDate)}</strong>
          </p>
        ) : null}
      </div>

      <form className="flex flex-col gap-3" action={action}>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm text-[#0A3D45]">
            <span className="mb-1 block text-xs font-medium">Month</span>
            <select
              name="month"
              required
              defaultValue={parts?.month ?? ""}
              className="tide-input"
            >
              <option value="" disabled>
                Month
              </option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString("en-US", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#0A3D45]">
            <span className="mb-1 block text-xs font-medium">Day</span>
            <input
              name="day"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={parts?.day ?? ""}
              className="tide-input w-20"
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm text-[#0A3D45]">
          <input
            type="checkbox"
            name="shareBirthdayFriends"
            defaultChecked={shareBirthdayFriends}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Share birthday with friends</span>
            <span className="block text-xs text-[#0A3D45]/60">
              Auto-share when “ask before sharing” is off.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-[#0A3D45]">
          <input
            type="checkbox"
            name="shareBirthdayWorkspaces"
            defaultChecked={shareBirthdayWorkspaces}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Share birthday with workspaces</span>
            <span className="block text-xs text-[#0A3D45]/60">
              Workspace owners still approve before it appears on their calendar.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-[#0A3D45]">
          <input
            type="checkbox"
            name="askBeforeShareBirthday"
            defaultChecked={askBeforeShareBirthday}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Ask before sharing</span>
            <span className="block text-xs text-[#0A3D45]/60">
              Always ask when you add a friend or join a workspace — whether the
              options above are on or off.
            </span>
          </span>
        </label>

        {state && !state.ok ? (
          <p className="text-sm text-[#9b2f22]">{state.error}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <SubmitButton
            label={birthdayDate ? "Update birthday" : "Add birthday"}
          />
          {birthdayDate ? (
            <button
              type="submit"
              name="clear"
              value="true"
              className="text-sm font-semibold text-[#9b2f22]"
            >
              Remove birthday
            </button>
          ) : null}
        </div>
      </form>

      {pickerFriends ? (
        <div className="rounded-lg border border-[#0A3D45]/15 bg-[#0A3D45]/[0.03] p-4">
          <p className="text-sm font-semibold text-[#0A3D45]">
            Share with current friends?
          </p>
          <p className="mt-1 text-xs text-[#0A3D45]/65">
            You already have friends. Share with everyone, pick specific people,
            or skip for now.
          </p>

          {shareMode === null ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={shareAction}>
                <input type="hidden" name="mode" value="all" />
                <SubmitButton label="Share with all friends" />
              </form>
              <button
                type="button"
                className="tide-btn-secondary text-sm"
                onClick={() => setShareMode("select")}
              >
                Select friends
              </button>
              <button
                type="button"
                className="text-sm text-[#0A3D45]/60"
                onClick={() => setPickerFriends(null)}
              >
                Skip
              </button>
            </div>
          ) : (
            <form className="mt-3 space-y-2" action={shareAction}>
              <input type="hidden" name="mode" value="select" />
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {pickerFriends.map((f) => (
                  <li key={f.id}>
                    <label className="flex items-center gap-2 text-sm text-[#0A3D45]">
                      <input
                        type="checkbox"
                        name="friendId"
                        value={f.id}
                        checked={selected.includes(f.id)}
                        onChange={(e) => {
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, f.id]
                              : prev.filter((id) => id !== f.id),
                          );
                        }}
                      />
                      {f.label}
                    </label>
                  </li>
                ))}
              </ul>
              {shareState && !shareState.ok ? (
                <p className="text-sm text-[#9b2f22]">{shareState.error}</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-[#0A3D45]/60"
                  onClick={() => setShareMode(null)}
                >
                  Back
                </button>
                <SubmitButton label="Share birthday" />
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
