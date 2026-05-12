import { z } from "zod";
import type { ProblemConfig, SubmissionArtifacts } from "./types";

// PRD §5.4 Dimension 4 — Notes quality. Three sub-scores 1–3.
// CRITICAL: empty/absent notes → all sub-scores null, NOT zero. The orchestrator
// must skip calling this function entirely when notes is empty.
export const notesOutputSchema = z.object({
  awarenessScore: z.number().int().min(1).max(3),
  honestyScore: z.number().int().min(1).max(3),
  processScore: z.number().int().min(1).max(3),
  summary: z.string(),
});

export type NotesOutput = z.infer<typeof notesOutputSchema>;

export function buildNotesSystem(problem: ProblemConfig): string {
  return `You are scoring the **notes quality** dimension of an AI-leverage coding assessment.

The participant submitted free-form notes alongside their code. Score three sub-dimensions on a 1–3 scale each, then give a one-paragraph summary.

1. **awareness** — does the participant flag AI-specific limitations in what they built?
   - 3: explicit awareness of AI failure modes relevant to their solution (e.g. hallucination risk, non-determinism, trust in API shape)
   - 2: generic awareness of limitations, not AI-specific
   - 1: no awareness expressed

2. **honesty** — intellectual honesty about what's incomplete, wrong, or untested
   - 3: specific, candid acknowledgement of gaps with rationale
   - 2: surface-level acknowledgement ("didn't finish the stretch goal")
   - 1: claims completeness, overstates results, or asserts confidence without basis

3. **process** — does the note reveal something about how they worked that the code doesn't show
   - 3: describes a specific decision, dead-end, or tradeoff that the code can't show
   - 2: describes high-level approach
   - 1: no process content (only "what" not "how" or "why")

End with a one-paragraph summary.

---

PROBLEM CONTEXT
================
Title: ${problem.title}
Hidden constraint relevant to honest notes: ${problem.hiddenConstraint}
Ambiguous requirement participants had to resolve: ${problem.ambiguousRequirement}
`;
}

export function buildNotesUserPrompt(notesText: string): string {
  return `Score the participant's notes against the three sub-dimensions in the system prompt. Then write a one-paragraph summary.

PARTICIPANT NOTES
=================
${notesText}
`;
}
