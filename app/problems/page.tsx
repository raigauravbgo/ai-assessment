import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { resolveFlowState } from "@/lib/auth/flow";
import { prisma } from "@/lib/db";
import { ProblemCards } from "./problem-cards";

export default async function ProblemsPage() {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/");

  const flow = await resolveFlowState(participant);
  if (flow.stage === "no-cycle") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            No active assessment cycle
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your administrator hasn&apos;t scheduled a cycle for your role yet. Check
            back later, or get in touch.
          </p>
        </div>
      </main>
    );
  }
  if (flow.stage !== "select-problem") redirect("/submit");

  const problems = await prisma.problem.findMany({
    where: { id: { in: flow.problemIds } },
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Hi {participant.name},
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pick a problem
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You have 48 hours from the moment you pick. Once you choose, the
            timer starts and you can&apos;t switch — so read all three first.
          </p>
        </div>
        <ProblemCards problems={problems} />
      </div>
    </main>
  );
}
