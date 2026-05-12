// Scoring pipeline orchestrator. Called after a participant uploads their zip.
//
// Flow:
//   1. Load Submission + Problem + DiagnosticResponses from DB
//   2. Pull zip from storage, extract source files + file tree
//   3. Run 5 dimension prompts in parallel via scoreWithLLM
//      (Notes dimension is conditionally skipped if notesText is empty —
//       PRD §5.4 Dimension 4: empty notes → null sub-scores, NOT zero)
//   4. Compute zone score (0–3), trap counts, diagnostic avg
//   5. Apply pure bucketing function from lib/scoring/bucket
//   6. Upsert Score row (raw Claude responses included for auditability per PRD §11)
//   7. Mark Submission status = "scored"

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/config/diagnostic-questions";
import { extractZip } from "@/lib/zip/extract";
import { loadZip } from "@/lib/zip/storage";
import {
  zoneOutputSchema,
  buildZoneSystem,
  buildZoneUserPrompt,
  trapsOutputSchema,
  buildTrapsSystem,
  buildTrapsUserPrompt,
  aiFingerprintOutputSchema,
  buildAiFingerprintSystem,
  buildAiFingerprintUserPrompt,
  notesOutputSchema,
  buildNotesSystem,
  buildNotesUserPrompt,
  diagnosticOutputSchema,
  DIAGNOSTIC_SYSTEM,
  buildDiagnosticUserPrompt,
  type ProblemConfig,
  type SubmissionArtifacts,
} from "@/prompts";
import { bucketSuggestion } from "./bucket";
import { scoreWithLLM } from "./llm";

export async function scoreSubmission(submissionId: string): Promise<{
  scoreId: string;
  bucket: "fast" | "slow" | "low";
}> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      problem: true,
      diagnosticResponses: { orderBy: { questionIndex: "asc" } },
    },
  });

  if (!submission.zipPath) {
    throw new Error(`submission ${submissionId} has no zipPath — not ready to score`);
  }

  const zipBytes = await loadZip(submission.zipPath);
  const extracted = extractZip(zipBytes);

  const problem: ProblemConfig = {
    id: submission.problem.id,
    role: submission.problem.role,
    title: submission.problem.title,
    description: submission.problem.description,
    zoneCriteria: submission.problem.zoneCriteria as ProblemConfig["zoneCriteria"],
    trapDefinitions: submission.problem.trapDefinitions as ProblemConfig["trapDefinitions"],
    ambiguousRequirement: submission.problem.ambiguousRequirement,
    messyDataSpec: submission.problem.messyDataSpec,
    hiddenConstraint: submission.problem.hiddenConstraint,
  };

  const artifacts: SubmissionArtifacts = {
    fileTree: extracted.fileTree,
    sourceFiles: extracted.sourceFiles,
    notes: submission.notesText,
    diagnosticResponses: submission.diagnosticResponses.map((r) => ({
      questionIndex: r.questionIndex,
      questionText:
        DIAGNOSTIC_QUESTIONS[r.questionIndex]?.text ?? `Question ${r.questionIndex}`,
      responseText: r.responseText,
    })),
  };

  const notesText = submission.notesText?.trim();
  const notesIsScorable = typeof notesText === "string" && notesText.length > 0;

  const [zoneRes, trapsRes, aiRes, notesRes, diagRes] = await Promise.all([
    scoreWithLLM({
      dimensionName: "zone",
      systemPrompt: buildZoneSystem(problem),
      userPrompt: buildZoneUserPrompt(artifacts),
      schema: zoneOutputSchema,
    }),
    scoreWithLLM({
      dimensionName: "traps",
      systemPrompt: buildTrapsSystem(problem),
      userPrompt: buildTrapsUserPrompt(artifacts),
      schema: trapsOutputSchema,
    }),
    scoreWithLLM({
      dimensionName: "aiFingerprint",
      systemPrompt: buildAiFingerprintSystem(problem),
      userPrompt: buildAiFingerprintUserPrompt(artifacts),
      schema: aiFingerprintOutputSchema,
    }),
    notesIsScorable
      ? scoreWithLLM({
          dimensionName: "notes",
          systemPrompt: buildNotesSystem(problem),
          userPrompt: buildNotesUserPrompt(notesText!),
          schema: notesOutputSchema,
        })
      : Promise.resolve(null),
    scoreWithLLM({
      dimensionName: "diagnostic",
      systemPrompt: DIAGNOSTIC_SYSTEM,
      userPrompt: buildDiagnosticUserPrompt(
        artifacts,
        DIAGNOSTIC_QUESTIONS.map((q) => q.text),
      ),
      schema: diagnosticOutputSchema,
    }),
  ]);

  const zoneScore =
    (zoneRes.parsed.floorCleared ? 1 : 0) +
    (zoneRes.parsed.middleCleared ? 1 : 0) +
    (zoneRes.parsed.stretchAttempted ? 1 : 0);

  const trapsCaught = trapsRes.parsed.results.filter(
    (r) => r.status === "caught",
  ).length;
  const trapsCaughtOrPartial = trapsRes.parsed.results.filter(
    (r) => r.status === "caught" || r.status === "partial",
  ).length;

  const diagnosticAvg =
    diagRes.parsed.perQuestion.reduce((sum, q) => sum + q.score, 0) / 3;

  const suggestion = bucketSuggestion({
    zoneFloorCleared: zoneRes.parsed.floorCleared,
    trapsCaught,
    trapsCaughtOrPartial,
    aiFingerprintScore: aiRes.parsed.overallScore,
    diagnosticAvg,
  });

  const findQ = (idx: 0 | 1 | 2): number =>
    diagRes.parsed.perQuestion.find((q) => q.questionIndex === idx)?.score ?? 1;

  // Trap definitions are exactly 3 by schema — index access is safe.
  const t1 = trapsRes.parsed.results[0];
  const t2 = trapsRes.parsed.results[1];
  const t3 = trapsRes.parsed.results[2];

  const scoreData: Prisma.ScoreUncheckedCreateInput = {
    submissionId: submission.id,
    zoneScore,
    zoneReasoning: zoneRes.parsed.observations as Prisma.InputJsonValue,
    trap1Status: t1.status,
    trap2Status: t2.status,
    trap3Status: t3.status,
    trapEvidence: trapsRes.parsed.results as unknown as Prisma.InputJsonValue,
    aiFingerprintScore: aiRes.parsed.overallScore,
    aiFingerprintMarkers: aiRes.parsed.markers as unknown as Prisma.InputJsonValue,
    aiFingerprintSummary: aiRes.parsed.summary,
    notesAwarenessScore: notesRes?.parsed.awarenessScore ?? null,
    notesHonestyScore: notesRes?.parsed.honestyScore ?? null,
    notesProcessScore: notesRes?.parsed.processScore ?? null,
    notesSummary: notesRes?.parsed.summary ?? null,
    diagnosticQ1Score: findQ(0),
    diagnosticQ2Score: findQ(1),
    diagnosticQ3Score: findQ(2),
    diagnosticRevealingPhrase: diagRes.parsed.mostRevealingPhrase,
    diagnosticRevealingReason: diagRes.parsed.mostRevealingReason,
    suggestedBucket: suggestion.bucket,
    bucketReasoning: suggestion.reasoning,
    rawResponses: {
      zone: zoneRes.rawResponse,
      traps: trapsRes.rawResponse,
      aiFingerprint: aiRes.rawResponse,
      notes: notesRes?.rawResponse ?? null,
      diagnostic: diagRes.rawResponse,
    } as unknown as Prisma.InputJsonValue,
  };

  const score = await prisma.score.upsert({
    where: { submissionId: submission.id },
    create: scoreData,
    update: scoreData,
  });

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: "scored" },
  });

  return { scoreId: score.id, bucket: suggestion.bucket };
}
