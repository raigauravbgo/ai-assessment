// PRD §5.5 — bucketing logic.
// Pure function of dimension scores. No LLM, no DB. The admin UI reads the
// reasoning string verbatim, so phrasing matters here.
//
// Bucket criteria (verbatim from PRD §5.5):
//   Fast multiplier — AI fingerprint 4–5 AND 2+ traps caught AND diagnostic
//     avg > 2.0. Zone floor must be cleared.
//   Slow multiplier — Any signal present but not consistently strong.
//   Low multiplier  — AI fingerprint 1–2 AND traps mostly missed AND
//     diagnostic orientation flat — ALL THREE must be true.
//
// "Traps mostly missed" is interpreted as `caughtOrPartialCount <= 1`
// (≥2 traps fully missed, ≤1 partial credit).
// "Diagnostic flat" is interpreted as `diagnosticAvg <= 1.5`
// (mostly 1s on the forward/backward axis).

import type { Bucket } from "@/generated/prisma/client";

export type BucketInputs = {
  /** Floor zone cleared per PRD §5.4 Dimension 1 — minimum threshold for fast bucket. */
  zoneFloorCleared: boolean;
  /** Count of traps with status === "caught". 0–3. */
  trapsCaught: number;
  /** Count of traps with status === "caught" OR status === "partial". 0–3. */
  trapsCaughtOrPartial: number;
  /** PRD §5.4 Dimension 3 overall score. 1–5. */
  aiFingerprintScore: number;
  /** PRD §5.4 Dimension 5 average across the three diagnostic questions. 1–3. */
  diagnosticAvg: number;
};

export type BucketSuggestion = {
  bucket: Bucket;
  reasoning: string;
};

const FAST_AI_THRESHOLD = 4;
const FAST_TRAPS_THRESHOLD = 2;
const FAST_DIAGNOSTIC_THRESHOLD = 2.0; // strict greater than

const LOW_AI_THRESHOLD = 2;
const LOW_TRAPS_CAUGHT_OR_PARTIAL_THRESHOLD = 1; // ≤
const LOW_DIAGNOSTIC_THRESHOLD = 1.5; // ≤

export function bucketSuggestion(s: BucketInputs): BucketSuggestion {
  const fastChecks = {
    aiFingerprint: s.aiFingerprintScore >= FAST_AI_THRESHOLD,
    traps: s.trapsCaught >= FAST_TRAPS_THRESHOLD,
    diagnostic: s.diagnosticAvg > FAST_DIAGNOSTIC_THRESHOLD,
    floor: s.zoneFloorCleared,
  };
  if (
    fastChecks.aiFingerprint &&
    fastChecks.traps &&
    fastChecks.diagnostic &&
    fastChecks.floor
  ) {
    return {
      bucket: "fast",
      reasoning: `Fast multiplier — all four conditions met: AI fingerprint ${s.aiFingerprintScore}/5, ${s.trapsCaught}/3 traps caught, diagnostic avg ${s.diagnosticAvg.toFixed(2)}, floor cleared.`,
    };
  }

  const lowChecks = {
    aiFingerprint: s.aiFingerprintScore <= LOW_AI_THRESHOLD,
    traps: s.trapsCaughtOrPartial <= LOW_TRAPS_CAUGHT_OR_PARTIAL_THRESHOLD,
    diagnostic: s.diagnosticAvg <= LOW_DIAGNOSTIC_THRESHOLD,
  };
  if (lowChecks.aiFingerprint && lowChecks.traps && lowChecks.diagnostic) {
    return {
      bucket: "low",
      reasoning: `Low multiplier — all three convergent signals: AI fingerprint ${s.aiFingerprintScore}/5, ${s.trapsCaughtOrPartial}/3 traps caught-or-partial, diagnostic avg ${s.diagnosticAvg.toFixed(2)}. Per PRD §5.5 this requires every dimension to converge; verify before confirming.`,
    };
  }

  return {
    bucket: "slow",
    reasoning: describeSlow(s, fastChecks, lowChecks),
  };
}

function describeSlow(
  s: BucketInputs,
  fastChecks: { aiFingerprint: boolean; traps: boolean; diagnostic: boolean; floor: boolean },
  lowChecks: { aiFingerprint: boolean; traps: boolean; diagnostic: boolean },
): string {
  // Explain the closest miss — fast bucket missed by X, OR low bucket avoided by Y.
  const fastMet = Object.values(fastChecks).filter(Boolean).length;
  const lowMet = Object.values(lowChecks).filter(Boolean).length;
  const summary = `AI fingerprint ${s.aiFingerprintScore}/5, ${s.trapsCaught}/3 traps caught (${s.trapsCaughtOrPartial}/3 caught-or-partial), diagnostic avg ${s.diagnosticAvg.toFixed(2)}, floor ${s.zoneFloorCleared ? "cleared" : "not cleared"}.`;
  if (fastMet === 3) {
    const missed: string[] = [];
    if (!fastChecks.aiFingerprint) missed.push(`AI fingerprint below ${FAST_AI_THRESHOLD}`);
    if (!fastChecks.traps) missed.push(`fewer than ${FAST_TRAPS_THRESHOLD} traps caught`);
    if (!fastChecks.diagnostic) missed.push(`diagnostic avg not > ${FAST_DIAGNOSTIC_THRESHOLD}`);
    if (!fastChecks.floor) missed.push("floor not cleared");
    return `Slow multiplier — close to fast but ${missed.join(", ")}. ${summary}`;
  }
  if (lowMet === 2) {
    return `Slow multiplier — one strong dimension prevented the low bucket (which requires all three weak). ${summary}`;
  }
  return `Slow multiplier — mixed signals, neither consistently strong nor convergently weak. ${summary}`;
}

// ---------------------------------------------------------------------------
// Headline score — a derived 0–10 number for sortable / shareable comparison.
//
// Bucket remains the authoritative label per PRD §5.5. The headline score is
// a deterministic function of the same dimensions, intended for cohort views
// and external reporting where a single number is more legible than a label.
//
// Weights (must sum to 1.0):
//   AI fingerprint  40%  — PRD §5.4 D3 is the most important dimension
//   Trap handling   20%  — strongest objective signal
//   Diagnostic      20%  — forward orientation
//   Zone completion 15%  — once floor is cleared, less differentiating
//   Notes quality    5%  — optional dimension; rebalanced if absent
//
// If notes are absent (sub-scores null per PRD §5.4 D4), notes' 5% weight is
// redistributed across the other four dimensions proportionally — so a
// participant who skipped notes is neither penalised nor rewarded for it.
// ---------------------------------------------------------------------------

export type HeadlineInputs = {
  /** PRD §5.4 D1: count of zones cleared (0–3). */
  zoneScore: number;
  /** PRD §5.4 D2: count of traps with status === "caught" (0–3). */
  trapsCaught: number;
  /** PRD §5.4 D3 overall: 1–5. */
  aiFingerprintScore: number;
  /** PRD §5.4 D5: avg of the three per-question scores (1–3). */
  diagnosticAvg: number;
  /** PRD §5.4 D4: null if notes weren't submitted (distinct from a weak note). */
  notes: {
    awarenessScore: number;
    honestyScore: number;
    processScore: number;
  } | null;
};

const HEADLINE_WEIGHTS = {
  aiFingerprint: 0.4,
  traps: 0.2,
  diagnostic: 0.2,
  zone: 0.15,
  notes: 0.05,
} as const;

/** Returns a 0–10 score, rounded to one decimal. */
export function headlineScore(s: HeadlineInputs): number {
  const aiFpNorm = clamp01((s.aiFingerprintScore - 1) / 4); // 1→0, 5→1
  const trapsNorm = clamp01(s.trapsCaught / 3); // 0→0, 3→1
  const zoneNorm = clamp01(s.zoneScore / 3); // 0→0, 3→1
  const diagNorm = clamp01((s.diagnosticAvg - 1) / 2); // 1→0, 3→1

  const components: Array<[number, number]> = [
    [aiFpNorm, HEADLINE_WEIGHTS.aiFingerprint],
    [trapsNorm, HEADLINE_WEIGHTS.traps],
    [diagNorm, HEADLINE_WEIGHTS.diagnostic],
    [zoneNorm, HEADLINE_WEIGHTS.zone],
  ];

  if (s.notes) {
    const notesAvg =
      (s.notes.awarenessScore + s.notes.honestyScore + s.notes.processScore) / 3;
    const notesNorm = clamp01((notesAvg - 1) / 2);
    components.push([notesNorm, HEADLINE_WEIGHTS.notes]);
  } else {
    // Renormalize the other 4 weights so they still sum to 1.
    const total = components.reduce((acc, [, w]) => acc + w, 0); // 0.95
    for (let i = 0; i < components.length; i++) {
      components[i] = [components[i][0], components[i][1] / total];
    }
  }

  const weightedSum = components.reduce((acc, [v, w]) => acc + v * w, 0);
  return Math.round(weightedSum * 100) / 10; // 0–10, one decimal
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Helper for UI / report code paths that have a Score row directly.
// Returns null when the score record is missing (caller decides how to
// render "—" vs the number).
export function headlineFromScore(
  score: {
    zoneScore: number;
    trap1Status: string;
    trap2Status: string;
    trap3Status: string;
    aiFingerprintScore: number;
    diagnosticQ1Score: number;
    diagnosticQ2Score: number;
    diagnosticQ3Score: number;
    notesAwarenessScore: number | null;
    notesHonestyScore: number | null;
    notesProcessScore: number | null;
  } | null,
): number | null {
  if (!score) return null;
  const trapsCaught = [score.trap1Status, score.trap2Status, score.trap3Status].filter(
    (s) => s === "caught",
  ).length;
  const diagnosticAvg =
    (score.diagnosticQ1Score + score.diagnosticQ2Score + score.diagnosticQ3Score) / 3;
  const notes =
    score.notesAwarenessScore !== null &&
    score.notesHonestyScore !== null &&
    score.notesProcessScore !== null
      ? {
          awarenessScore: score.notesAwarenessScore,
          honestyScore: score.notesHonestyScore,
          processScore: score.notesProcessScore,
        }
      : null;
  return headlineScore({
    zoneScore: score.zoneScore,
    trapsCaught,
    aiFingerprintScore: score.aiFingerprintScore,
    diagnosticAvg,
    notes,
  });
}
