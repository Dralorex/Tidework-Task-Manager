import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const events = await prisma.calendarEvent.findMany({
    where: { userId: user.id },
    include: { task: true },
    orderBy: { dueDate: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#0A3D45]">
          Your calendar
        </h1>
        <p className="mt-2 text-[#0A3D45]/70">
          Claimed tasks with a due date land here. No due date means no calendar entry.
        </p>

        <ul className="mt-8 space-y-3">
          {events.length === 0 ? (
            <li className="text-[#0A3D45]/60">Nothing on the tide chart yet.</li>
          ) : (
            events.map((event) => (
              <li
                key={event.id}
                className="tide-panel flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-semibold text-[#0A3D45]">{event.title}</p>
                  <p className="text-sm text-[#0A3D45]/60">
                    {format(event.dueDate, "EEE, MMM d yyyy")}
                  </p>
                </div>
                <Link
                  href={`/app/w/${event.task.workspaceId}?folder=${event.task.folderId}`}
                  className="tide-btn-secondary text-sm"
                >
                  Open
                </Link>
              </li>
            ))
          )}
        </ul>
      </main>
  );
}
