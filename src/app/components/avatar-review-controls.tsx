"use client";

import { useTransition } from "react";
import { reviewAvatarAction } from "@/app/actions/avatar";

export function AvatarReviewControls({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  function decide(decision: "approved" | "rejected") {
    startTransition(async () => {
      await reviewAvatarAction(userId, decision);
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="tide-btn text-sm disabled:opacity-60"
        disabled={pending}
        onClick={() => decide("approved")}
      >
        Approve
      </button>
      <button
        type="button"
        className="tide-btn-secondary text-sm disabled:opacity-60"
        disabled={pending}
        onClick={() => decide("rejected")}
      >
        Reject
      </button>
    </div>
  );
}
