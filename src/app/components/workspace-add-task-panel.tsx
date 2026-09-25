"use client";

import { useEffect, useState } from "react";
import { GuidedCreateTaskForm } from "@/app/components/guided-create-task-form";
import { WorkspaceCollapsible } from "@/app/components/workspace-collapsible";
import { useWorkspaceOnboarding } from "@/app/components/workspace-onboarding-context";

export function WorkspaceAddTaskPanel({
  workspaceId,
  folderId,
  publicTagOptions,
  assignableMembers,
}: {
  workspaceId: string;
  folderId: string;
  publicTagOptions: string[];
  assignableMembers: { id: string; username: string }[];
}) {
  const { active, step, setStep, blink } = useWorkspaceOnboarding();
  const [open, setOpen] = useState(false);

  // Keep Add Task open once the guided tour is past the header step
  useEffect(() => {
    if (!active) return;
    const stayOpen =
      step !== "create-folder" &&
      step !== "open-folder" &&
      step !== "open-add-task" &&
      step !== "done";
    if (stayOpen) setOpen(true);
  }, [active, step]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && active && step === "open-add-task") {
      setStep("task-name");
    }
  }

  return (
    <WorkspaceCollapsible
      id="workspace-add-task"
      title="Add Task"
      description="Create a claimable task in this folder. Starts closed so the task list stays front and center."
      open={open}
      onOpenChange={onOpenChange}
      blinkEmpty={blink("add-task-header")}
    >
      <GuidedCreateTaskForm
        workspaceId={workspaceId}
        folderId={folderId}
        publicTagOptions={publicTagOptions}
        assignableMembers={assignableMembers}
      />
    </WorkspaceCollapsible>
  );
}
