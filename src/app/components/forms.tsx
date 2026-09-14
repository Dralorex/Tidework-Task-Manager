"use client";

import { useActionState, useState, useTransition } from "react";

export type ActionResult =
  | { ok: true; resetUrl?: string }
  | { ok: false; error: string };

type AuthAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult | null>;

export function AuthForm({
  action,
  submitLabel,
  children,
  extras,
}: {
  action: AuthAction;
  submitLabel: string;
  children: React.ReactNode;
  extras?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form className="flex w-full flex-col gap-4" action={formAction}>
      {children}
      {state && !state.ok ? (
        <p className="rounded-lg bg-[#E85D4C]/12 px-3 py-2 text-sm text-[#9b2f22]">
          {state.error}
        </p>
      ) : null}
      {state && state.ok && state.resetUrl ? (
        <p className="rounded-lg bg-[#3DBEAB]/15 px-3 py-2 text-sm text-[#0A3D45]">
          Reset link ready (dev): {state.resetUrl} — in production this would be emailed.
        </p>
      ) : null}
      {state && state.ok && !state.resetUrl ? (
        <p className="rounded-lg bg-[#3DBEAB]/15 px-3 py-2 text-sm text-[#0A3D45]">
          If that account has an email, a reset link was prepared.
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

/** For bound server actions shaped as (...args, formData) => ActionResult */
export function InlineActionForm({
  action,
  submitLabel,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
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
          if (!result.ok) setError(result.error);
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
