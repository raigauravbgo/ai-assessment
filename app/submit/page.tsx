import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { resolveFlowState } from "@/lib/auth/flow";
import { prisma } from "@/lib/db";
import { SubmitForm } from "./submit-form";

export default async function SubmitPage() {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/");

  const flow = await resolveFlowState(participant);
  if (flow.stage === "no-cycle") redirect("/problems");
  if (flow.stage === "select-problem") redirect("/problems");
  if (flow.stage === "diagnostic") redirect("/diagnostic");
  if (flow.stage === "done") redirect("/done");

  const problem = await prisma.problem.findUniqueOrThrow({
    where: { id: flow.problemId },
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {problem.title}
        </h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {problem.description}
        </p>
        <div className="mt-4">
          <a
            href={`/fixtures/${problem.id}.zip`}
            download
            className="inline-block rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-600"
          >
            Download starter data ↓
          </a>
        </div>
        <SubmitForm deadlineAtIso={flow.deadlineAt.toISOString()} />
      </div>
    </main>
  );
}
