import { z } from "zod";
import type { ProblemConfig, SubmissionArtifacts } from "./types";
import { formatSourceBundle } from "./format";

// PRD §5.4 Dimension 2 — Trap handling.
export const trapStatusSchema = z.enum(["caught", "partial", "missed"]);

export const trapsOutputSchema = z.object({
  results: z
    .array(
      z.object({
        trapName: z.string(),
        status: trapStatusSchema,
        evidenceCitation: z.string(),
      }),
    )
    .length(3),
});

export type TrapsOutput = z.infer<typeof trapsOutputSchema>;

export function buildTrapsSystem(problem: ProblemConfig): string {
  const trapBlock = problem.trapDefinitions
    .map(
      (t, i) => `
TRAP ${i + 1}: ${t.name}
  Caught (concrete evidence that the participant handled this):
    ${t.caughtLooksLike}
  Missed (concrete evidence the participant did NOT handle this):
    ${t.missedLooksLike}`,
    )
    .join("\n");

  return `You are scoring the **trap handling** dimension of an AI-leverage coding assessment.

For each of the three traps defined below, classify the participant's code as caught / partial / missed, and cite ONE specific piece of evidence (file path + brief description of what you saw or didn't see). The admin needs to be able to verify your call in 30 seconds.

Rules:
- "caught"  — clear, deliberate handling matching the "Caught looks like" definition. Comments alone don't count unless they describe an implemented behaviour.
- "partial" — partial handling. Acknowledged the trap but did not fully address it, OR addressed it for some cases but not others.
- "missed"  — no handling, no acknowledgement, OR active exhibition of the failure mode described in "Missed looks like".

Do NOT invent traps that aren't in the list. Score exactly the three below.

---

PROBLEM
========
Title: ${problem.title}

Description (for context — not what you're scoring):
${problem.description}

THREE TRAPS TO SCORE
====================
${trapBlock}
`;
}

export function buildTrapsUserPrompt(artifacts: SubmissionArtifacts): string {
  return `Score each of the three traps in the system prompt. Return one result entry per trap, in the same order. Each entry must include the trap name verbatim, status, and a one-line evidence citation.

FILE TREE
=========
${artifacts.fileTree}

SOURCE FILES
============
${formatSourceBundle(artifacts.sourceFiles)}
`;
}
