import { z } from "zod";
import type { ProblemConfig, SubmissionArtifacts } from "./types";
import { formatSourceBundle } from "./format";

// PRD §5.4 Dimension 1 — Zone completion. Binary per zone, observation per zone.
export const zoneOutputSchema = z.object({
  floorCleared: z.boolean(),
  middleCleared: z.boolean(),
  stretchAttempted: z.boolean(),
  observations: z.object({
    floor: z.string(),
    middle: z.string(),
    stretch: z.string(),
  }),
});

export type ZoneOutput = z.infer<typeof zoneOutputSchema>;

export function buildZoneSystem(problem: ProblemConfig): string {
  return `You are scoring the **zone completion** dimension of an AI-leverage coding assessment.

Your job is to read the participant's code against three concrete completion zones defined for this problem and answer three binary questions:
1. Is the FLOOR cleared?
2. Is the MIDDLE cleared?
3. Was the STRETCH attempted?

For each zone, return one observation (a single sentence) citing specific evidence from the code — file name and what you saw. No vibe-reading: if the criterion isn't demonstrably met, mark it not cleared.

Note: "stretch attempted" is a lower bar than cleared. Look for any meaningful gesture toward the stretch criteria, not full implementation.

---

PROBLEM
========
Title: ${problem.title}

Description (participant-facing):
${problem.description}

Zone criteria for THIS problem:
- FLOOR: ${problem.zoneCriteria.floor}
- MIDDLE: ${problem.zoneCriteria.middle}
- STRETCH: ${problem.zoneCriteria.stretch}

Other context (do not score against — for understanding what the problem asks):
- Ambiguous requirement: ${problem.ambiguousRequirement}
- Hidden constraint: ${problem.hiddenConstraint}
`;
}

export function buildZoneUserPrompt(artifacts: SubmissionArtifacts): string {
  return `Score zone completion against the criteria in the system prompt.

FILE TREE
=========
${artifacts.fileTree}

SOURCE FILES
============
${formatSourceBundle(artifacts.sourceFiles)}
`;
}
