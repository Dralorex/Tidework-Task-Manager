import Link from "next/link";
import { AuthForm } from "@/app/components/forms";
import { resetPasswordAction } from "@/app/actions/auth";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="tide-wave-bg flex min-h-screen items-center justify-center px-4">
        <div className="tide-panel max-w-md p-8 text-center">
          <p>Missing reset token.</p>
          <Link href="/forgot-password" className="mt-4 inline-block font-semibold">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  async function action(
    prev: { ok: true; resetUrl?: string } | { ok: false; error: string } | null,
    formData: FormData,
  ) {
    "use server";
    formData.set("token", token!);
    return resetPasswordAction(prev, formData);
  }

  return (
    <main className="tide-wave-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="tide-panel w-full max-w-md p-8 animate-tide-rise">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]"
        >
          Rowgon
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-[#0A3D45]">
          Choose a new password
        </h1>
        <div className="mt-6">
          <AuthForm action={action} submitLabel="Update password">
            <input type="hidden" name="token" value={token} />
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0A3D45]">
              New password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="tide-input"
              />
            </label>
          </AuthForm>
        </div>
      </div>
    </main>
  );
}
