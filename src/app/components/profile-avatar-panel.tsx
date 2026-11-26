"use client";

import { useRef, useState, useTransition } from "react";
import {
  removeAvatarAction,
  uploadAvatarAction,
} from "@/app/actions/avatar";
import {
  AvatarCropper,
  type AvatarShape,
} from "@/app/components/avatar-cropper";
import { UserAvatar } from "@/app/components/user-avatar";

export function ProfileAvatarPanel({
  userId,
  label,
  shape,
  status,
}: {
  userId: string;
  label: string;
  shape: string;
  status: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPick(file: File | undefined) {
    setError(null);
    setMessage(null);
    if (!file) return;
    if (file.type !== "image/png") {
      setError("Please choose a PNG file.");
      return;
    }
    setCropFile(file);
  }

  function onConfirm(blob: Blob, nextShape: AvatarShape) {
    setCropFile(null);
    const form = new FormData();
    form.set("shape", nextShape);
    form.set("avatar", new File([blob], "avatar.png", { type: "image/png" }));
    startTransition(async () => {
      const result = await uploadAvatarAction(null, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
    });
  }

  function onRemove() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
    });
  }

  const statusLabel =
    status === "approved"
      ? "Live"
      : status === "pending"
        ? "Pending review"
        : status === "rejected"
          ? "Rejected — try another"
          : "No photo yet";

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-[#0A3D45]">Profile picture</h3>
      <p className="text-xs text-[#0A3D45]/60">
        PNG only. You’ll crop with zoom and drag before saving. Photos are
        safety-checked; clear NSFW is blocked, borderline ones wait for a
        moderator.
      </p>

      <div className="flex items-center gap-4">
        <UserAvatar
          userId={userId}
          label={label}
          shape={shape}
          status={status === "rejected" ? "none" : status}
          size={72}
        />
        <div className="min-w-0 text-sm text-[#0A3D45]/75">
          <p>
            Status: <strong>{statusLabel}</strong>
          </p>
          <p className="text-xs text-[#0A3D45]/55">
            Shape: {shape === "rounded" ? "Rounded box" : "Circle"}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="tide-btn-secondary text-sm disabled:opacity-60"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Working…" : "Upload PNG"}
        </button>
        {status !== "none" ? (
          <button
            type="button"
            className="tide-btn-secondary text-sm disabled:opacity-60"
            disabled={pending}
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[#9b2f22]">{error}</p> : null}
      {message ? (
        <p className="text-sm text-[#0A3D45]/75">{message}</p>
      ) : null}

      {cropFile ? (
        <AvatarCropper
          file={cropFile}
          initialShape={shape === "rounded" ? "rounded" : "circle"}
          onCancel={() => setCropFile(null)}
          onConfirm={onConfirm}
        />
      ) : null}
    </div>
  );
}
