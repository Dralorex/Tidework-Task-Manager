"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeFriendAction,
  updateFriendProfileAction,
} from "@/app/actions/social";
import { confirmDelete } from "@/lib/confirm";
import { MenuSurface, menuItemClass } from "@/app/components/menu-surface";

export function FriendRowMenu({
  friendshipId,
  friendUserId,
  friendLabel,
  personalNickname,
  personalNotes,
}: {
  friendshipId: string;
  friendUserId: string;
  friendLabel: string;
  personalNickname?: string | null;
  personalNotes?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "nickname" | "notes">("menu");
  const [nickname, setNickname] = useState(personalNickname ?? "");
  const [notes, setNotes] = useState(personalNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setNickname(personalNickname ?? "");
  }, [personalNickname]);

  useEffect(() => {
    setNotes(personalNotes ?? "");
  }, [personalNotes]);

  function close() {
    setOpen(false);
    setPanel("menu");
    setError(null);
  }

  async function remove() {
    if (!confirmDelete(`friend ${friendLabel}`)) return;
    const fd = new FormData();
    fd.set("friendshipId", friendshipId);
    const result = await removeFriendAction(null, fd);
    close();
    if (result?.ok) router.refresh();
    else if (result && !result.ok) alert(result.error);
  }

  function saveProfile(fields: {
    personalNickname: string;
    personalNotes: string;
  }) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("friendUserId", friendUserId);
      fd.set("personalNickname", fields.personalNickname);
      fd.set("personalNotes", fields.personalNotes);
      const result = await updateFriendProfileAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <div className="relative shrink-0">
      <MenuSurface
        open={open}
        onClose={close}
        widthClass={panel === "menu" ? "min-w-[10rem]" : "w-64"}
        trigger={({ ref }) => (
          <button
            ref={ref}
            type="button"
            aria-label="Friend options"
            aria-expanded={open}
            className="rounded-md px-2 py-1 text-[#0A3D45]/70 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45]"
            onClick={() => {
              setOpen((v) => !v);
              setPanel("menu");
              setError(null);
            }}
          >
            ···
          </button>
        )}
      >
        {panel === "menu" ? (
          <>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass()}
              onClick={() => setPanel("nickname")}
            >
              Personal nickname
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass()}
              onClick={() => setPanel("notes")}
            >
              Personal notes
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass(true)}
              onClick={() => void remove()}
            >
              Remove friend
            </button>
          </>
        ) : null}

        {panel === "nickname" ? (
          <form
            className="space-y-2 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile({
                personalNickname: nickname,
                personalNotes: personalNotes ?? "",
              });
            }}
          >
            <label className="block text-xs font-medium text-[#0A3D45]">
              Personal nickname
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={40}
                className="tide-input mt-1 w-full text-sm"
                placeholder="Only you see this"
                autoFocus
              />
            </label>
            {error ? <p className="text-xs text-[#9b2f22]">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="tide-btn-secondary text-xs disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="text-xs text-[#0A3D45]/60 hover:underline"
                onClick={() => {
                  setPanel("menu");
                  setError(null);
                }}
              >
                Back
              </button>
            </div>
          </form>
        ) : null}

        {panel === "notes" ? (
          <form
            className="space-y-2 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile({
                personalNickname: personalNickname ?? "",
                personalNotes: notes,
              });
            }}
          >
            <label className="block text-xs font-medium text-[#0A3D45]">
              Personal notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={4}
                className="tide-input mt-1 w-full resize-y text-sm"
                placeholder="Private notes about this friend"
                autoFocus
              />
            </label>
            {error ? <p className="text-xs text-[#9b2f22]">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="tide-btn-secondary text-xs disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="text-xs text-[#0A3D45]/60 hover:underline"
                onClick={() => {
                  setPanel("menu");
                  setError(null);
                }}
              >
                Back
              </button>
            </div>
          </form>
        ) : null}
      </MenuSurface>
    </div>
  );
}
