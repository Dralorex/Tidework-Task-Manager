"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  kickMemberAction,
  updateMemberRoleAction,
} from "@/app/actions/workspaces";
import { confirmDelete } from "@/lib/confirm";
import { MenuSurface, menuItemClass } from "@/app/components/menu-surface";

/** Admin+ member actions: change role (owner) and/or kick. */
export function WorkspaceMemberMenu({
  workspaceId,
  memberUserId,
  memberLabel,
  memberRole,
  viewerRole,
}: {
  workspaceId: string;
  memberUserId: string;
  memberLabel: string;
  memberRole: string;
  viewerRole: string;
}) {
  const isOwner = viewerRole === "OWNER";
  const canKick = viewerRole === "OWNER" || viewerRole === "ADMIN";
  const targetIsOwner = memberRole === "OWNER";
  const targetIsAdmin = memberRole === "ADMIN";

  const canChangeRole = isOwner && !targetIsOwner;
  const canRemove =
    canKick &&
    !targetIsOwner &&
    !(viewerRole === "ADMIN" && targetIsAdmin);

  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "role">("menu");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canChangeRole && !canRemove) return null;

  function close() {
    setOpen(false);
    setPanel("menu");
    setError(null);
  }

  function run(
    action: typeof kickMemberAction | typeof updateMemberRoleAction,
    fields: Record<string, string>,
    opts?: { confirmLabel?: string },
  ) {
    if (opts?.confirmLabel && !confirmDelete(opts.confirmLabel)) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const result = await action(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <div
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <MenuSurface
        open={open}
        onClose={close}
        widthClass="w-52"
        trigger={({ ref }) => (
          <button
            ref={ref}
            type="button"
            aria-label={`Manage ${memberLabel}`}
            aria-expanded={open}
            className="rounded-md px-2 py-0.5 text-[#0A3D45]/70 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
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
          <div className="py-1">
            {canChangeRole ? (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass()}
                disabled={pending}
                onClick={() => setPanel("role")}
              >
                Change role
              </button>
            ) : null}
            {canRemove ? (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass(true)}
                disabled={pending}
                onClick={() =>
                  run(
                    kickMemberAction,
                    {
                      workspaceId,
                      memberUserId,
                    },
                    {
                      confirmLabel: `${memberLabel} from this workspace`,
                    },
                  )
                }
              >
                Remove from workspace
              </button>
            ) : null}
          </div>
        ) : null}

        {panel === "role" && canChangeRole ? (
          <div className="space-y-2 px-3 py-2">
            <button
              type="button"
              className="text-xs text-[#0A3D45]/60"
              onClick={() => setPanel("menu")}
            >
              ← Back
            </button>
            <p className="text-xs font-semibold text-[#0A3D45]">Role</p>
            <select
              className="tide-input py-1 text-xs"
              defaultValue={memberRole}
              disabled={pending}
              onChange={(e) =>
                run(updateMemberRoleAction, {
                  workspaceId,
                  memberUserId,
                  role: e.target.value,
                })
              }
            >
              <option value="ADMIN">Admin</option>
              <option value="EDITOR">Editor</option>
              <option value="MEMBER">Member</option>
            </select>
          </div>
        ) : null}

        {error ? (
          <p className="border-t border-[#0A3D45]/10 px-3 py-2 text-xs text-[#9b2f22]">
            {error}
          </p>
        ) : null}
      </MenuSurface>
    </div>
  );
}
