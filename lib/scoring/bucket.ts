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
