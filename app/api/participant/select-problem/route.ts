import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { resolveFlowState } from "@/lib/auth/flow";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  problemId: z.string().min(1),
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
  if (flow.stage === "no-cycle") {
    return NextResponse.json({ error: "no_active_cycle" }, { status: 400 });
  }
  if (flow.stage !== "select-problem") {
    return NextResponse.json(
      { error: "already_selected", stage: flow.stage },
      { status: 409 },
    );
  }
  if (!flow.problemIds.includes(parsed.data.problemId)) {
    return NextResponse.json(
      { error: "problem_not_in_cycle" },
      { status: 400 },
    );
  }

  const submission = await prisma.submission.create({
    data: {
      participantId: participant.id,
      cycleId: flow.cycleId,
      problemId: parsed.data.problemId,
      status: "selected",
    },
  });

  return NextResponse.json({ ok: true, submissionId: submission.id });
}
