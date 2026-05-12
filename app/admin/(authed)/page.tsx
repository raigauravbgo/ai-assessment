import Link from "next/link";
import { prisma } from "@/lib/db";

// Aggregate view (PRD §8). Lists all submissions across all cycles, newest first.
// For a hackathon-sized cohort (~15 participants) filters aren't needed; if the
// list grows past one screen, add filter pills on status / bucket.

function statusBadge(status: string): string {
  switch (status) {
    case "selected":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    case "submitted":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200";
    case "scored":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200";
    case "expired":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function bucketBadge(bucket: string | null | undefined): string {
  if (!bucket) return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  if (bucket === "fast")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100";
  if (bucket === "low")
    return "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100";
}

function relativeTime(d: Date | null): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) return `${diffHr}h ago`;
  return d.toISOString().slice(0, 10);
}

export default async function AdminHome() {
  const submissions = await prisma.submission.findMany({
    include: {
      participant: true,
      problem: true,
      cycle: true,
      score: true,
      adminDecision: true,
    },
    orderBy: { selectedAt: "desc" },
    take: 200,
  });

  const cycleCount = await prisma.assessmentCycle.count();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Submissions
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {submissions.length} submission{submissions.length === 1 ? "" : "s"} across {cycleCount}{" "}
          cycle{cycleCount === 1 ? "" : "s"}. Click a row to see scoring detail and confirm or override the bucket.
        </p>
      </div>

      {submissions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Participant</th>
                <th className="px-4 py-2 font-medium">Problem</th>
                <th className="px-4 py-2 font-medium">Cycle</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Submitted</th>
                <th className="px-4 py-2 font-medium">Bucket</th>
                <th className="px-4 py-2 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/submissions/${s.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {s.participant.name}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {s.participant.role}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                    {s.problem.title}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {s.cycle.name}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${statusBadge(s.status)}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {relativeTime(s.submittedAt)}
                  </td>
                  <td className="px-4 py-2">
                    {s.score ? (
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${bucketBadge(s.score.suggestedBucket)}`}
                      >
                        {s.score.suggestedBucket}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {s.adminDecision ? (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {s.adminDecision.flagged
                          ? "flagged"
                          : s.adminDecision.confirmedBucket
                            ? `confirmed ${s.adminDecision.confirmedBucket}`
                            : "noted"}
                      </span>
                    ) : (
                      <span className="text-zinc-400">pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      No submissions yet.
      <div className="mt-2 font-mono text-xs">
        npm run cycle:new -- --role engineering --hours 48
        <br />
        npm run participant:new -- --name &quot;Jane Doe&quot;
      </div>
    </div>
  );
}
