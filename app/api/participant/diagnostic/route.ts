import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { resolveFlowState } from "@/lib/auth/flow";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/config/diagnostic-questions";
import { prisma } from "@/lib/db";
import { scoreSubmission } from "@/lib/scoring/orchestrate";

const bodySchema = z.object({
  questionIndex: z.number().int().min(0).max(2),
  responseText: z.string().min(1).max(5000),
});

export async function POST(req: Request) {
  const participant = await getCurrentParticipant();
  if (!participant) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const flow = await resolveFlowState(participant);
  if (flow.stage !== "diagnostic") {
    return NextResponse.json(
      { error: "not_in_diagnostic_stage", stage: flow.stage },
      { status: 409 },
    );
  }
  if (parsed.data.questionIndex !== flow.nextQuestionIndex) {
    return NextResponse.json(
      { error: "out_of_order", expectedIndex: flow.nextQuestionIndex },
      { status: 409 },
    );
  }

  await prisma.diagnosticResponse.create({
    data: {
      submissionId: flow.submissionId,
      questionIndex: parsed.data.questionIndex,
      responseText: parsed.data.responseText,
    },
  });

  const newCount = flow.nextQuestionIndex + 1;
  const done = newCount >= DIAGNOSTIC_QUESTIONS.length;

  if (done) {
    // Kick off scoring asynchronously — don't block the HTTP response on the
    // 5-prompt Claude pipeline. Failures are logged; admin retries via TBD UI.
    const submissionId = flow.submissionId;
    void scoreSubmission(submissionId).catch((err) => {
      console.error(`scoreSubmission(${submissionId}) failed:`, err);
    });
  }

  return NextResponse.json({ ok: true, done });
}
