import Link from "next/link";
import { prisma } from "@/lib/db";
import { CreateCycleForm } from "./create-cycle-form";

export default async function CyclesPage() {
  const cycles = await prisma.assessmentCycle.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Cycles
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A cycle is one assessment run. Create one cycle per hackathon / quarterly check-in, then add participants to it.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          New cycle
        </h2>
        <CreateCycleForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Existing cycles
        </h2>
        {cycles.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No cycles yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Window</th>
                  <th className="px-4 py-2 font-medium">Submissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {cycles.map((c) => {
                  const isActive = c.windowEnd > new Date();
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/cycles/${c.id}`}
                          className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                        >
                          {c.name}
                        </Link>
                        {isActive && (
                          <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                            active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                        {c.role}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {c.windowStart.toISOString().slice(0, 10)} →{" "}
                        {c.windowEnd.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                        {c._count.submissions}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
