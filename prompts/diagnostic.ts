import { z } from "zod";
import type { SubmissionArtifacts } from "./types";

// PRD §5.4 Dimension 5 — Diagnostic responses. 1–3 per question + extract
// the single most revealing phrase across all three combined.
export const diagnosticOutputSchema = z.object({
  perQuestion: z
    .array(
      z.object({
        questionIndex: z.number().int().min(0).max(2),
        score: z.number().int().min(1).max(3),
        explanation: z.string(),
      }),
    )
    .length(3),
  mostRevealingPhrase: z.string(),
  mostRevealingReason: z.string(),
});

export type DiagnosticOutput = z.infer<typeof diagnosticOutputSchema>;

// Pure-text system prompt — no problem config dependency, so the same cached
// prefix serves every submission across every problem on this dimension.
export const DIAGNOSTIC_SYSTEM = `You are scoring the **diagnostic responses** dimension of an AI-leverage assessment.

The participant answered three short debrief questions after submitting their code. Each answer is scored on a single axis: forward orientation vs backward orientation.

Scale (per question):
- 1 = entirely backward-looking, no AI-native thinking visible. Examples: "It worked, nothing to add", "I would have fixed bugs", denying any moments of AI distrust, treating AI output as either fully trusted or fully ignored.
- 2 = mixed. Some forward orientation but also backward elements, or surface-level engagement with AI specifics.
- 3 = clearly forward-oriented. Specific AI-aware thinking: distrust + action taken, iteration on AI use, AI-specific risk awareness, deliberate prompt design, validation around AI output.

Per-question scoring intent (the *axis* each question targets):
- Q0 (distrust + response): score 3 if they describe a SPECIFIC moment of distrust AND the action they took. Score 1 if they deny any distrust or describe AI as a black box.
- Q1 (mental model): score 3 if their hypothetical extra time goes into AI use iteration (better prompts, more validation, alternative approaches). Score 1 if it goes into manual cleanup (fix bugs by hand, polish UI, add features).
- Q2 (risk awareness): score 3 if they name AI-specific risks (hallucinated APIs, security gaps AI misses, validation around AI output). Score 1 if they only name generic risks (perf, edge cases, tests).

Give a one-sentence explanation per question keyed to specific words in the answer.

After scoring all three, identify ONE phrase from any of the three answers that is most revealing of the participant's relationship with AI — either positively or negatively. Quote it verbatim and explain in one sentence why it's revealing.`;

export function buildDiagnosticUserPrompt(
  artifacts: SubmissionArtifacts,
  questionTexts: readonly string[],
): string {
  const answers = artifacts.diagnosticResponses
    .map((r, i) => `Q${r.questionIndex}: ${questionTexts[r.questionIndex] ?? questionTexts[i] ?? "(unknown question)"}\nA: ${r.responseText}`)
    .join("\n\n");
  return `Score the three diagnostic responses below. Return one entry per question in order (questionIndex 0, 1, 2).

THREE QUESTIONS AND ANSWERS
============================
${answers}
`;
}
