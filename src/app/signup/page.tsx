import Link from "next/link";
import { SignUpForm } from "@/app/components/signup-form";
import { signUpAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignUpPage({
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
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[#0A3D45]/70">
          Username and password are enough. Add an email to get a welcome confirmation
          and password reset later.
        </p>

        <div className="mt-6">
          <SignUpForm
            action={signUpAction}
            next={
              next?.startsWith("/") && !next.startsWith("//") ? next : undefined
            }
          />
        </div>

        <p className="mt-6 text-center text-sm text-[#0A3D45]/70">
          Already aboard?{" "}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="font-semibold text-[#0A3D45] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
