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

Score each of FIVE markers on a 1–3 scale and give one specific code example per marker:

1. **criticalOverrideEvidence** — Comments, alternative implementations, or error handling suggesting the developer evaluated AI output and made a deliberate correction.
   - 3: clear evidence of "AI suggested X, I chose Y because Z"
   - 2: some evidence of correction or refinement
   - 1: code looks accepted as-is OR fully hand-written with no AI integration

2. **iterativeStructure** — Code that looks refined in passes rather than written in one go; helper functions that wrap AI output in validation layers; prompt templates stored as constants.
   - 3: clear pass-based refinement, validation wrappers, constants for prompts
   - 2: some structure suggesting iteration
   - 1: monolithic blob, or no AI integration at all

3. **promptDesignQuality** — If prompts are stored as strings or constants, what do they look like?
   - 3: constraint-aware, with output format specification, edge cases addressed
   - 2: structured but naive — "do X, return Y" without constraints
   - 1: no prompts in code (because no AI is used at runtime) OR single-sentence naive prompts

4. **trustCalibration** — Where did they add logging, validation, or fallbacks? Does that calibration make sense given where AI is likely to fail on this problem?
   - 3: validation placed exactly where AI typically fails on this problem (see hidden constraint and trap definitions in context)
   - 2: some defensive code, calibration roughly aligns with risk
   - 1: no validation OR validation placed in low-risk areas while high-risk areas are unchecked

5. **absenceSignals** — Two distinct flags, scored together. Code that is entirely hand-written with no AI integration is a flag (rating 1). Code that is a raw AI dump with zero human judgment layered on top is also a flag (rating 1). Both are problematic in different ways.
   - 3: clear human judgment AND clear AI leverage are both present
   - 2: mostly one or the other, with some of the missing dimension
   - 1: pure hand-written OR pure AI dump

After scoring each marker, give an **overallScore** from 1–5:
   - 5: strong, balanced AI-native judgment across most markers
   - 4: clear evidence of AI-native judgment, one weak area
   - 3: mixed — some judgment, some gaps
   - 2: limited evidence of AI-native judgment, several weak areas
   - 1: little or no evidence of AI-native judgment (either no AI use, or raw acceptance)

Finish with a 2-sentence summary.

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
