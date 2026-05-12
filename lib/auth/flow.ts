// Resolves what page a participant should currently be on, given their state.
// Used by each page in the participant flow to enforce the correct ordering
// and redirect on out-of-order navigation.

import type { Participant } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/config/diagnostic-questions";

export type FlowState =
  | { stage: "select-problem"; cycleId: string; problemIds: string[] }
  | { stage: "upload"; submissionId: string; problemId: string; deadlineAt: Date }
  | { stage: "diagnostic"; submissionId: string; nextQuestionIndex: number }
  | { stage: "done"; submissionId: string }
  | { stage: "no-cycle" };

export async function resolveFlowState(participant: Participant): Promise<FlowState> {
  const cycle = await prisma.assessmentCycle.findFirst({
    where: { role: participant.role, windowEnd: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!cycle) return { stage: "no-cycle" };

  const submission = await prisma.submission.findUnique({
    where: {
      participantId_cycleId: { participantId: participant.id, cycleId: cycle.id },
    },
    include: {
      diagnosticResponses: { orderBy: { questionIndex: "asc" } },
    },
  });

  if (!submission) {
    return {
      stage: "select-problem",
      cycleId: cycle.id,
      problemIds: cycle.problemIds,
    };
  }

  const deadlineAt = new Date(submission.selectedAt.getTime() + 48 * 60 * 60 * 1000);

  // Zip not yet uploaded → still in upload stage (even if past 48h, let them see the expired state)
  if (!submission.zipPath) {
    return {
      stage: "upload",
      submissionId: submission.id,
      problemId: submission.problemId,
      deadlineAt,
    };
  }

  // Zip uploaded, diagnostic in progress
  const nextQuestionIndex = submission.diagnosticResponses.length;
  if (nextQuestionIndex < DIAGNOSTIC_QUESTIONS.length) {
    return {
      stage: "diagnostic",
      submissionId: submission.id,
      nextQuestionIndex,
    };
  }

  return { stage: "done", submissionId: submission.id };
}
