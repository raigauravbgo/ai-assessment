import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { resolveFlowState } from "@/lib/auth/flow";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/config/diagnostic-questions";
import { DiagnosticChat } from "./diagnostic-chat";

export default async function DiagnosticPage() {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/");

  const flow = await resolveFlowState(participant);
  if (flow.stage === "no-cycle") redirect("/problems");
  if (flow.stage === "select-problem") redirect("/problems");
  if (flow.stage === "upload") redirect("/submit");
  if (flow.stage === "done") redirect("/done");

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-6">
      <div className="max-w-xl mx-auto">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Before you go — three quick questions.
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          No right answers, just how it went.
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Should take about five minutes.
        </p>
        <DiagnosticChat
          questions={DIAGNOSTIC_QUESTIONS.map((q) => ({
            index: q.index,
            text: q.text,
          }))}
          initialIndex={flow.nextQuestionIndex}
        />
      </div>
    </main>
  );
}
