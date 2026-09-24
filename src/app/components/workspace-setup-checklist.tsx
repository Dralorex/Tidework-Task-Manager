"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const storageKey = (workspaceId: string) =>
  `tidework-setup-dismissed:${workspaceId}`;

export function WorkspaceSetupChecklist({
  workspaceId,
  forceShow,
  hasFolder,
  hasTask,
  hasInvite,
  canInvite,
  canEdit,
  firstFolderId,
}: {
  workspaceId: string;
  /** From ?setup=1 after first workspace create */
  forceShow: boolean;
  hasFolder: boolean;
  hasTask: boolean;
  hasInvite: boolean;
  canInvite: boolean;
  canEdit: boolean;
  firstFolderId: string | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!canEdit) {
      setVisible(false);
      return;
    }
    try {
      if (localStorage.getItem(storageKey(workspaceId))) {
        setVisible(false);
        return;
      }
    } catch {
      /* private mode */
    }
    // Hide once the core loop is set up (folder + task)
    if (hasFolder && hasTask) {
      setVisible(false);
      return;
    }
    // After first create, or while creator still has no folders
    setVisible(forceShow || !hasFolder);
  }, [workspaceId, forceShow, hasFolder, hasTask, canEdit]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey(workspaceId), "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  const steps = [
    {
      done: hasFolder,
      label: "Create a folder",
      hint: "Topic bucket, e.g. General — not a status like In Progress",
    },
    {
      done: hasTask,
      label: "Add a task",
      hint: "Something people can claim, then send for review",
    },
    ...(canInvite
      ? [
          {
            done: hasInvite,
            label: "Invite someone (optional)",
            hint: "Share the invite link from the Invite panel",
          },
        ]
      : []),
  ];

  return (
    <div className="tide-panel mt-6 border border-[#1a7a82]/25 p-5 animate-tide-rise">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
            Get your workspace going
          </h2>
          <p className="mt-1 text-sm text-[#0A3D45]/70">
            One folder, one task, and you’re in the claim → review loop.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-sm text-[#0A3D45]/55 hover:text-[#0A3D45] hover:underline"
        >
          Dismiss
        </button>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex gap-3 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-[#3DBEAB] text-[#0A3D45]"
                  : "bg-[#0A3D45]/10 text-[#0A3D45]/50"
              }`}
              aria-hidden
            >
              {step.done ? "✓" : ""}
            </span>
            <div>
              <p
                className={
                  step.done
                    ? "font-medium text-[#0A3D45]/55 line-through"
                    : "font-medium text-[#0A3D45]"
                }
              >
                {step.label}
              </p>
              <p className="text-[#0A3D45]/60">{step.hint}</p>
            </div>
          </li>
        ))}
      </ol>
      {!hasFolder ? (
        <p className="mt-4 text-xs text-[#0A3D45]/55">
          Use <span className="font-medium">New folder</span> in the sidebar — try “General”.
        </p>
      ) : !hasTask && firstFolderId ? (
        <p className="mt-4 text-xs text-[#0A3D45]/55">
          Open{" "}
          <Link
            href={`/app/w/${workspaceId}?folder=${firstFolderId}`}
            className="font-medium underline underline-offset-2"
          >
            your folder
          </Link>
          , then use Add task.
        </p>
      ) : null}
    </div>
  );
}
