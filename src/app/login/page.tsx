import Link from "next/link";
import { AuthForm } from "@/app/components/forms";
import { ShowPasswordField } from "@/app/components/show-password-field";
import { signInAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/app");

  return (
    <main className="tide-wave-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="tide-panel w-full max-w-md p-8 animate-tide-rise">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]"
        >
          Tidework
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-[#0A3D45]">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-[#0A3D45]/70">Sign in with your username.</p>

        <div className="mt-6">
          <AuthForm
            action={signInAction}
            submitLabel="Sign in"
            extras={
              <Link
                href="/forgot-password"
                className="text-center text-sm text-[#0A3D45]/70 underline-offset-2 hover:underline"
              >
                Forgot password?
              </Link>
            }
          >
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0A3D45]">
              Username
              <input
                name="username"
                required
                autoComplete="username"
                className="tide-input"
              />
            </label>
            <ShowPasswordField autoComplete="current-password" />
          </AuthForm>
        </div>

        <p className="mt-6 text-center text-sm text-[#0A3D45]/70">
          New here?{" "}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="font-semibold text-[#0A3D45] underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
