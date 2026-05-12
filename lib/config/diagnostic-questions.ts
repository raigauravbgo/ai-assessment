// PRD §5.3 + PRD §13 Open Question #1: diagnostic question wording.
// Final wording lives in code (not DB) so it can be version-controlled and
// reviewed in a PR. Intent comes from PRD §5.3; phrasing is calibrated to feel
// like a debrief conversation rather than an evaluation.
//
// ⚠️ PLACEHOLDER WORDING — flagged in PLAN.md / PRD §13 for review before
// the first cohort runs. Don't change the intent without re-reading §5.3:
// each question targets a specific axis the scorer keys off.

export type DiagnosticQuestion = {
  /** 0, 1, 2 — matches `DiagnosticResponse.questionIndex` in the schema. */
  index: 0 | 1 | 2;
  /** Verbatim text shown to the participant. */
  text: string;
  /** Internal note — not shown to participant. Tells the scorer what to look for. */
  scoringIntent: string;
};

export const DIAGNOSTIC_QUESTIONS: readonly DiagnosticQuestion[] = [
  {
    index: 0,
    text: "Was there a point in this work where you weren't sure about something AI gave you? What did you do?",
    scoringIntent:
      "Q1 (PRD §5.3): distrust + response. Forward-oriented answers describe a specific moment of distrust AND the action taken. Backward-oriented answers deny any distrust or describe AI as a black box.",
  },
  {
    index: 1,
    text: "If you had another 24 hours on this, what would you spend them on?",
    scoringIntent:
      "Q2 (PRD §5.3): mental model. Forward-oriented = iterating on AI use (better prompts, more validation, alternative approaches). Backward-oriented = manual cleanup (fix bugs by hand, polish UI, add features).",
  },
  {
    index: 2,
    text: "If a colleague pulled this code into production tomorrow, what's the first thing you'd want them to double-check?",
    scoringIntent:
      "Q3 (PRD §5.3): risk awareness. Forward-oriented = AI-specific risks (hallucinated APIs, security gaps AI misses, validation around AI output). Backward-oriented = only generic technical risks (perf, edge cases, tests).",
  },
] as const;

if (DIAGNOSTIC_QUESTIONS.length !== 3) {
  throw new Error("DIAGNOSTIC_QUESTIONS must contain exactly 3 entries (PRD §5.3)");
}
