import Link from "next/link";
import { AuthForm } from "@/app/components/forms";
import { requestPasswordResetAction } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  return (
    <main className="rowgon-wave-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="rowgon-panel w-full max-w-md p-8 animate-rowgon-rise">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]"
        >
          Rowgon
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-[#0A3D45]">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-[#0A3D45]/70">
          Works only if your account has an email. Otherwise add one after signing in, or
          ask a workspace admin for help.
        </p>

        <div className="mt-6">
          <AuthForm action={requestPasswordResetAction} submitLabel="Send reset link">
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0A3D45]">
              Username or email
              <input name="identifier" required className="rowgon-input" />
            </label>
          </AuthForm>
        </div>

        <p className="mt-6 text-center text-sm text-[#0A3D45]/70">
          <Link href="/login" className="font-semibold underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
