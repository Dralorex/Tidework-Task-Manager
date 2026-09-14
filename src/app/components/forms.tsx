"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/actions/auth";

export type { ActionResult };

type FormAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult | null>;

function SubmitButton({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? "Working…" : label}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  children,
  extras,
}: {
  action: FormAction;
  submitLabel: string;
  children: React.ReactNode;
  extras?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);

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
      <SubmitButton label={submitLabel} className="tide-btn-primary" />
      {extras}
    </form>
  );
}

export function InlineActionForm({
  action,
  submitLabel,
  children,
  className,
}: {
  action: FormAction;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form className={className ?? "flex flex-col gap-3"} action={formAction}>
      {children}
      {state && !state.ok ? (
        <p className="text-sm text-[#9b2f22]">{state.error}</p>
      ) : null}
      <SubmitButton label={submitLabel} className="tide-btn-secondary text-sm" />
    </form>
  );
}
