import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { resolveFlowState } from "@/lib/auth/flow";

// PRD §6: "After each assessment, participants receive a brief personalised
// summary — directional, not judgmental. No bucket label is shared with
// participants." For v1 this is a static directional message; per-participant
// summary text is a future enhancement (admin-authored or AI-generated from
// the scoring output).

export default async function DonePage() {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/");

  const flow = await resolveFlowState(participant);
  if (flow.stage === "select-problem") redirect("/problems");
  if (flow.stage === "upload") redirect("/submit");
  if (flow.stage === "diagnostic") redirect("/diagnostic");

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-6 flex items-center justify-center">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          You&apos;re done — thanks, {participant.name}.
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
          Your submission has been received. A short directional summary will
          come back to you shortly. There&apos;s nothing else to do here.
        </p>
        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          You can close this window.
        </p>
      </div>
    </main>
  );
}
