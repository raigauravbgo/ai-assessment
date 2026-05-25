import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { AddParticipantForm } from "./add-participant-form";
import { TokenLink } from "./token-link";
import { DeleteParticipantButton } from "./delete-participant-button";
import { DeleteCycleButton } from "./delete-cycle-button";

type Params = Promise<{ id: string }>;

export default async function CycleDetail({ params }: { params: Params }) {
  const { id } = await params;
  const cycle = await prisma.assessmentCycle.findUnique({
    where: { id },
  });
  if (!cycle) notFound();

  // Get all participants in this cycle. Since the schema links them by role
  // (not directly to the cycle), we list participants whose submissions are
  // for this cycle, plus participants matching the cycle's role.
  // For the v1 hackathon model: cycle.role + Participant.role match is enough.
  const participants = await prisma.participant.findMany({
    where: {
      role: cycle.role,
      submissions: { some: { cycleId: cycle.id } },
    },
    include: {
      submissions: {
        where: { cycleId: cycle.id },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          score: { select: { suggestedBucket: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Also list participants who were created with this role but haven't been
  // added to a submission yet (newly created participants who haven't picked
  // a problem). The `participant:new` script + this UI both create the row
  // before any Submission exists, so we fetch them separately.
  const pendingParticipants = await prisma.participant.findMany({
    where: {
      role: cycle.role,
      submissions: { none: {} },
    },
    orderBy: { createdAt: "desc" },
  });

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const isActive = cycle.windowEnd > new Date();
  const submissionCount = participants.reduce(
    (acc, p) => acc + p.submissions.length,
    0,
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/cycles"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← all cycles
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {cycle.name}
          {isActive && (
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 align-middle text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
              active
            </span>
          )}
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          role: {cycle.role} · window {cycle.windowStart.toISOString().slice(0, 16).replace("T", " ")} → {cycle.windowEnd.toISOString().slice(0, 16).replace("T", " ")} UTC · {cycle.problemIds.length} problems available
        </p>
        {!isActive && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            This cycle&apos;s window has expired. Create a new cycle to onboard new participants — existing pending participants will auto-pick-up the new active cycle.
          </p>
        )}
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Add a participant
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Each person gets their own row + unique token URL. Copy the URL after creating and send it to them.
        </p>
        <AddParticipantForm cycleId={cycle.id} role={cycle.role} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Participants ({participants.length + pendingParticipants.length})
        </h2>
        {participants.length + pendingParticipants.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            None yet. Add one above.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Bucket</th>
                  <th className="px-4 py-2 font-medium">Token URL</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pendingParticipants.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                      {p.name}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        not started
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-400">—</td>
                    <td className="px-4 py-2">
                      <TokenLink url={`${baseUrl}/?token=${p.token}`} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeleteParticipantButton
                        participantId={p.id}
                        participantName={p.name}
                        hasSubmission={false}
                      />
                    </td>
                  </tr>
                ))}
                {participants.map((p) => {
                  const sub = p.submissions[0];
                  const bucket = sub?.score?.suggestedBucket ?? null;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                        {p.name}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/submissions/${sub.id}`}
                          className="text-xs text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                        >
                          {sub.status}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        {bucket ? (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {bucket}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <TokenLink url={`${baseUrl}/?token=${p.token}`} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <DeleteParticipantButton
                          participantId={p.id}
                          participantName={p.name}
                          hasSubmission={true}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Danger zone
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Deletes this cycle and any submissions inside it. Participants themselves are not deleted — they may belong to other cycles by role.
        </p>
        <DeleteCycleButton
          cycleId={cycle.id}
          cycleName={cycle.name}
          submissionCount={submissionCount}
        />
      </section>
    </div>
  );
}
