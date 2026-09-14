import Link from "next/link";
import { AuthForm } from "@/app/components/forms";
import { signUpAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

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
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[#0A3D45]/70">
          Username and password are enough. Add an email if you want password reset later.
        </p>

        <div className="mt-6">
          <AuthForm action={signUpAction} submitLabel="Create account">
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0A3D45]">
              Username
              <input
                name="username"
                required
                autoComplete="username"
                className="tide-input"
                placeholder="tide_rider"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0A3D45]">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="tide-input"
                placeholder="At least 8 characters"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0A3D45]">
              Email{" "}
              <span className="font-normal text-[#0A3D45]/55">(optional)</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="tide-input"
                placeholder="you@example.com"
              />
            </label>
            <p className="text-xs leading-relaxed text-[#0A3D45]/60">
              Email isn’t required. If you skip it, you won’t be able to reset a forgotten
              password until you add one in settings.
            </p>
          </AuthForm>
        </div>

        <p className="mt-6 text-center text-sm text-[#0A3D45]/70">
          Already aboard?{" "}
          <Link href="/login" className="font-semibold text-[#0A3D45] underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
