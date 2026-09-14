"use client";

import { useState, useTransition } from "react";

type ActionResult = { ok: true; resetUrl?: string } | { ok: false; error: string };

export function AuthForm({
  action,
  submitLabel,
  children,
  extras,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  extras?: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex w-full flex-col gap-4"
      action={(formData) => {
        setError(null);
        setInfo(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if ("resetUrl" in result && result.resetUrl) {
            setInfo(
              `Reset link ready (dev): ${result.resetUrl} — in production this would be emailed.`,
            );
          }
        });
      }}
    >
      {children}
      {error ? (
        <p className="rounded-lg bg-[#E85D4C]/12 px-3 py-2 text-sm text-[#9b2f22]">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg bg-[#3DBEAB]/15 px-3 py-2 text-sm text-[#0A3D45]">
          {info}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="tide-btn-primary disabled:opacity-60"
      >
        {pending ? "Working…" : submitLabel}
      </button>
      {extras}
    </form>
  );
}

export function InlineActionForm({
  action,
  submitLabel,
  children,
  className,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className ?? "flex flex-col gap-3"}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onSuccess?.();
        });
      }}
    >
      {children}
      {error ? <p className="text-sm text-[#9b2f22]">{error}</p> : null}
      <button type="submit" disabled={pending} className="tide-btn-secondary text-sm">
        {pending ? "…" : submitLabel}
      </button>
    </form>
  );
}
