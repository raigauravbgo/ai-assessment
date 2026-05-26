import { z } from "zod";
import type { ProblemConfig, SubmissionArtifacts } from "./types";

// PRD §5.4 Dimension 3 — AI fingerprint. The most important dimension.
// Looking for evidence of AI-native JUDGMENT, not AI-generated code.
export const AI_FINGERPRINT_MARKERS = [
  "criticalOverrideEvidence",
  "iterativeStructure",
  "promptDesignQuality",
  "trustCalibration",
  "absenceSignals",
] as const;

export const aiFingerprintOutputSchema = z.object({
  markers: z
    .array(
      z.object({
        marker: z.enum(AI_FINGERPRINT_MARKERS),
        rating: z.number().int().min(1).max(3),
        codeExample: z.string(),
      }),
    )
    .length(5),
  overallScore: z.number().int().min(1).max(5),
  summary: z.string(),
});

export type AiFingerprintOutput = z.infer<typeof aiFingerprintOutputSchema>;

export function buildAiFingerprintSystem(problem: ProblemConfig): string {
  return `You are scoring the **AI fingerprint** dimension of an AI-leverage coding assessment. This is the most important dimension.

You are NOT looking for AI-generated code. You ARE looking for evidence of AI-native JUDGMENT — that the developer used AI as a thinking partner and shaped its output with intent, rather than either avoiding AI entirely or accepting raw AI output without scrutiny.

EVIDENCE HIERARCHY
==================
Participants were asked to include their AI chat history as \`ai-chat.md\` at the root of the zip. If that file is present, treat it as PRIMARY evidence for markers 1, 2, and 3 — you can see the actual dialogue, the moments they pushed back, and the prompts they wrote. The code is secondary evidence.

If \`ai-chat.md\` is missing entirely, infer from code artifacts alone — but note this in your summary, because the absence of the chat file is itself a small signal (either careless submission or active avoidance of transparency).

If \`ai-chat.md\` is present but says they didn't use AI: treat that as a deliberate choice (not the same as a missing file). Marker 5 (absence signals) becomes the dominant marker — code should be entirely hand-written with clear human reasoning.

MARKERS
=======

Score each of FIVE markers on a 1–3 scale and give one specific evidence example per marker (quote from \`ai-chat.md\` if you used it, or cite file:line from code):

1. **criticalOverrideEvidence** — Did the participant push back on AI output? Evaluate, correct, or override what the AI suggested?
   - In chat: explicit pushback ("that won't work because X", "what about edge case Y", "let me redo this part myself")
   - In code: comments like "AI suggested X but doing Y because Z", divergent implementations
   - 3: clear, repeated pushback with reasoning
   - 2: some pushback, mostly accepting
   - 1: no pushback visible OR no AI used at all

2. **iterativeStructure** — Does the work show iteration / refinement rather than one-shot acceptance?
   - In chat: multiple turns where they refined direction, retried with new constraints
   - In code: helper functions wrapping AI output in validation layers, prompt constants, pass-based feel
   - 3: clear iterative loops, refinement passes
   - 2: some iteration
   - 1: one-and-done feel, or no AI integration

3. **promptDesignQuality** — Are their prompts constraint-aware, or naive?
   - In chat: prompts with explicit constraints, output format, edge cases mentioned
   - In code (if prompts stored as constants): constraint-aware vs single-sentence
   - 3: constraint-aware, output-format-specified, edge cases addressed
   - 2: structured but generic
   - 1: naive single-sentence prompts, OR no AI use

4. **trustCalibration** — Where did they add logging, validation, fallbacks? Does that calibration align with where AI typically fails on THIS problem (see context below)?
   - 3: validation placed exactly where AI is likely to fail on this problem
   - 2: some defensive code, calibration roughly aligns
   - 1: no validation, OR validation in low-risk places while high-risk areas are unchecked

5. **absenceSignals** — Two flags scored together:
   - All-hand-written / no AI integration = flag (intentional avoidance is itself a calibration choice; rate based on whether it makes sense for the problem)
   - Raw AI dump with zero human judgment = different flag
   - 3: clear human judgment AND clear AI leverage both visible
   - 2: mostly one or the other
   - 1: pure hand-written OR pure AI dump

OVERALL SCORE (1–5)
===================
   - 5: strong, balanced AI-native judgment across most markers
   - 4: clear evidence, one weak area
   - 3: mixed — some judgment, some gaps
   - 2: limited evidence, several weak areas
   - 1: little or no evidence of AI-native judgment

Finish with a 2-sentence summary that notes (a) whether \`ai-chat.md\` was present and informative, and (b) the most decisive evidence one way or the other.

---

PROBLEM CONTEXT (for understanding where AI is likely to fail on this task)
==========================================================================
Title: ${problem.title}
Hidden constraint AI typically misses on this problem: ${problem.hiddenConstraint}
Ambiguous requirement that requires participant judgment: ${problem.ambiguousRequirement}
`;
}

export function buildAiFingerprintUserPrompt(
  artifacts: SubmissionArtifacts,
): string {
  return `Score the five AI fingerprint markers in the system prompt. Then give the overall 1–5 score and a 2-sentence summary.

FILE TREE
=========
${artifacts.fileTree}

SOURCE FILES
============
${artifacts.sourceFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}
`;
}
