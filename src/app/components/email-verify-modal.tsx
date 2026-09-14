"use client";

import { useEffect, useState, useTransition } from "react";
import {
  resendEmailCodeAction,
  verifyEmailCodeAction,
} from "@/app/actions/email-verification";

export function EmailVerifyModal({
  email,
  next,
  redirectAfter = false,
  onVerified,
  onClose,
}: {
  email: string;
  next?: string;
  redirectAfter?: boolean;
  onVerified?: () => void;
  onClose?: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("code", code.trim());
      if (next) fd.set("next", next);
      if (redirectAfter) fd.set("redirectAfter", "true");
      const result = await verifyEmailCodeAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      onVerified?.();
    });
  }

  function resend() {
    if (secondsLeft > 0 || pending) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await resendEmailCodeAction(null, new FormData());
      if (result && !result.ok) {
        setError(result.error);
        if (result.retryAfterSec) setSecondsLeft(result.retryAfterSec);
        return;
      }
      setInfo("A new code was sent.");
      setSecondsLeft(30);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A3D45]/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-verify-title"
    >
      <div className="tide-panel w-full max-w-md p-6 shadow-lg">
        <h2
          id="email-verify-title"
          className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]"
        >
          Verify your email
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#0A3D45]/80">
          We sent a 4-digit code to <strong>{email}</strong>. Enter it below to
          confirm this address.
        </p>

        <form className="mt-5 flex flex-col gap-3" onSubmit={submitCode}>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#0A3D45]">
            Verification code
            <input
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              autoFocus
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="tide-input tracking-[0.35em] text-center text-xl"
              placeholder="••••"
            />
          </label>

          {error ? (
            <p className="text-sm text-[#9b2f22]">{error}</p>
          ) : null}
          {info ? (
            <p className="text-sm text-[#0A3D45]/75">{info}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending || code.length !== 4}
            className="tide-btn-primary disabled:opacity-50"
          >
            {pending ? "Checking…" : "Verify email"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            disabled={pending || secondsLeft > 0}
            onClick={resend}
            className="font-semibold text-[#0A3D45] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
          >
            {secondsLeft > 0
              ? `Resend email in ${secondsLeft}s`
              : "Resend email"}
          </button>
          {onClose ? (
            <button
              type="button"
              className="text-[#0A3D45]/60 underline-offset-2 hover:underline"
              onClick={onClose}
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
