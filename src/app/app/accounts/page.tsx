import { getAccountRosterPublic } from "@/lib/account-roster";
import { getCurrentUser } from "@/lib/auth";
import { switchAccountAction, removeDeviceAccountAction } from "@/app/actions/accounts";
import { InlineActionForm } from "@/app/components/forms";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const accounts = await getAccountRosterPublic(user.id);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[color:var(--tide-deep)]">
        Accounts
      </h1>
      <p className="mt-2 text-sm text-[color:var(--tide-deep)]/65">
        Accounts saved on this device. Switch anytime — personal, business, or
        anything else. They’re just separate logins.
      </p>

      <div className="tide-panel mt-8 space-y-3 p-5">
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account.userId}
              className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--tide-deep)]/10 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[color:var(--tide-deep)]">
                  {account.label}
                  {account.active ? (
                    <span className="ml-2 text-[11px] font-medium text-[color:var(--tide-deep)]/50">
                      Current
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-[color:var(--tide-deep)]/55">
                  @{account.username}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!account.active ? (
                  <InlineActionForm
                    action={switchAccountAction}
                    submitLabel="Switch"
                    className="flex"
                  >
                    <input type="hidden" name="userId" value={account.userId} />
                  </InlineActionForm>
                ) : null}
                <InlineActionForm
                  action={removeDeviceAccountAction}
                  submitLabel="Remove"
                  className="flex"
                >
                  <input type="hidden" name="userId" value={account.userId} />
                </InlineActionForm>
              </div>
            </li>
          ))}
        </ul>

        <Link
          href="/login?addAccount=1"
          className="mt-2 flex items-center gap-2 rounded-full bg-[color:var(--tide-deep)]/8 px-3 py-2.5 text-sm text-[color:var(--tide-deep)] hover:bg-[color:var(--tide-deep)]/12"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--tide-deep)] text-sm font-bold text-[color:var(--tide-foam)]">
            +
          </span>
          <span>
            <span className="font-semibold">Add Account</span>
            <span className="block text-xs text-[color:var(--tide-deep)]/60">
              Sign in to an existing account or create a new one.
            </span>
          </span>
        </Link>
      </div>
    </main>
  );
}
