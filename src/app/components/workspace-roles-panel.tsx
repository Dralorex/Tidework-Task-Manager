"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkspaceRoleAction,
  deleteWorkspaceRoleAction,
} from "@/app/actions/roles";
import { confirmDelete } from "@/lib/confirm";
import { ChatSidebarSection } from "@/app/components/chat-sidebar-section";

export function WorkspaceRolesPanel({
  workspaceId,
  roles,
  canManage,
}: {
  workspaceId: string;
  roles: { id: string; name: string; memberCount: number }[];
  canManage: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("name", name.trim());
      const result = await createWorkspaceRoleAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function remove(roleId: string, roleName: string) {
    if (!confirmDelete(`role “${roleName}”`)) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("roleId", roleId);
      const result = await deleteWorkspaceRoleAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="tide-panel p-4">
      <ChatSidebarSection
        title="Roles"
        description="Custom roles control folder access and role-based task alerts. Members can hold several at once."
      >
        <ul className="space-y-2 text-sm">
          {roles.map((role) => (
            <li
              key={role.id}
              className="flex items-center justify-between gap-2 text-[color:var(--tide-deep)]"
            >
              <span className="min-w-0 truncate font-medium">
                {role.name}
                <span className="ml-1.5 text-[11px] font-normal text-[color:var(--tide-deep)]/50">
                  {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
                </span>
              </span>
              {canManage ? (
                <button
                  type="button"
                  disabled={pending}
                  className="shrink-0 text-xs text-[color:var(--tide-coral)] hover:underline disabled:opacity-50"
                  onClick={() => remove(role.id, role.name)}
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
          {roles.length === 0 ? (
            <li className="text-xs text-[color:var(--tide-deep)]/55">
              No custom roles yet.
            </li>
          ) : null}
        </ul>

        {canManage ? (
          <form onSubmit={create} className="mt-3 flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New role name"
              className="tide-input text-sm"
              required
            />
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="tide-btn-secondary text-sm disabled:opacity-50"
            >
              {pending ? "Saving…" : "Create role"}
            </button>
          </form>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-[color:var(--tide-coral)]">{error}</p>
        ) : null}
      </ChatSidebarSection>
    </div>
  );
}
