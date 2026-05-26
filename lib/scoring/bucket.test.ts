import { describe, expect, it } from "vitest";
import { bucketSuggestion, headlineScore, type BucketInputs, type HeadlineInputs } from "./bucket";

// Default "passes everything" scoring used as a baseline; tests override fields.
const fastBaseline: BucketInputs = {
  zoneFloorCleared: true,
  trapsCaught: 2,
  trapsCaughtOrPartial: 2,
  aiFingerprintScore: 4,
  diagnosticAvg: 2.5,
};

const lowBaseline: BucketInputs = {
  zoneFloorCleared: false,
  trapsCaught: 0,
  trapsCaughtOrPartial: 1,
  aiFingerprintScore: 2,
  diagnosticAvg: 1.0,
};

describe("bucketSuggestion — fast bucket (PRD §5.5)", () => {
  it("returns fast when all four conditions met", () => {
    expect(bucketSuggestion(fastBaseline).bucket).toBe("fast");
  });

  it("regresses to slow when zone floor not cleared (the gate)", () => {
    const result = bucketSuggestion({ ...fastBaseline, zoneFloorCleared: false });
    expect(result.bucket).toBe("slow");
    expect(result.reasoning).toMatch(/floor not cleared/);
  });

  it("uses strict > 2.0 on diagnostic avg — exactly 2.0 is not fast", () => {
    const result = bucketSuggestion({ ...fastBaseline, diagnosticAvg: 2.0 });
    expect(result.bucket).toBe("slow");
  });

  it("admits 2.01 on diagnostic avg as fast", () => {
    expect(bucketSuggestion({ ...fastBaseline, diagnosticAvg: 2.01 }).bucket).toBe("fast");
  });

  it("requires AI fingerprint >= 4 — 3 is not fast", () => {
    expect(
      bucketSuggestion({ ...fastBaseline, aiFingerprintScore: 3 }).bucket,
    ).toBe("slow");
  });

  it("requires 2+ caught traps — 1 caught + 1 partial is not fast", () => {
    expect(
      bucketSuggestion({
        ...fastBaseline,
        trapsCaught: 1,
        trapsCaughtOrPartial: 2,
      }).bucket,
    ).toBe("slow");
  });

  it("accepts fingerprint score of 5", () => {
    expect(
      bucketSuggestion({ ...fastBaseline, aiFingerprintScore: 5 }).bucket,
    ).toBe("fast");
  });
});

describe("bucketSuggestion — low bucket (PRD §5.5 AND logic)", () => {
  it("returns low only when ALL three weak signals converge", () => {
    expect(bucketSuggestion(lowBaseline).bucket).toBe("low");
  });

  it("regresses to slow when AI fingerprint is 3 (boundary of low)", () => {
    expect(
      bucketSuggestion({ ...lowBaseline, aiFingerprintScore: 3 }).bucket,
    ).toBe("slow");
  });

  it("regresses to slow when diagnostic avg is 1.6 (just above flat threshold)", () => {
    expect(
      bucketSuggestion({ ...lowBaseline, diagnosticAvg: 1.6 }).bucket,
    ).toBe("slow");
  });

  it("regresses to slow when 2 traps caught-or-partial (just above mostly-missed)", () => {
    expect(
      bucketSuggestion({ ...lowBaseline, trapsCaughtOrPartial: 2 }).bucket,
    ).toBe("slow");
  });

  it("treats one strong dimension as enough to escape low", () => {
    // Two weak signals, one strong — PRD §5.5 'one weak dimension means nothing'
    const result = bucketSuggestion({
      ...lowBaseline,
      aiFingerprintScore: 4, // strong
    });
    expect(result.bucket).toBe("slow");
    expect(result.reasoning).toMatch(/one strong dimension prevented the low bucket/);
  });

  it("low bucket reasoning prompts admin verification (high-bar guard)", () => {
    expect(bucketSuggestion(lowBaseline).reasoning).toMatch(
      /verify before confirming/i,
    );
  });
});

describe("bucketSuggestion — slow bucket (everything else)", () => {
  it("returns slow for mixed signals", () => {
    expect(
      bucketSuggestion({
        zoneFloorCleared: true,
        trapsCaught: 1,
        trapsCaughtOrPartial: 2,
        aiFingerprintScore: 3,
        diagnosticAvg: 2.0,
      }).bucket,
    ).toBe("slow");
  });

  it("describes the closest miss when three of four fast conditions met", () => {
    const result = bucketSuggestion({
      ...fastBaseline,
      diagnosticAvg: 1.9,
    });
    expect(result.bucket).toBe("slow");
    expect(result.reasoning).toMatch(/close to fast/);
    expect(result.reasoning).toMatch(/diagnostic avg not > 2/);
  });
});

describe("headlineScore (derived 0–10 for reporting)", () => {
  const topInputs: HeadlineInputs = {
    zoneScore: 3,
    trapsCaught: 3,
    aiFingerprintScore: 5,
    diagnosticAvg: 3,
    notes: { awarenessScore: 3, honestyScore: 3, processScore: 3 },
  };
  const bottomInputs: HeadlineInputs = {
    zoneScore: 0,
    trapsCaught: 0,
    aiFingerprintScore: 1,
    diagnosticAvg: 1,
    notes: { awarenessScore: 1, honestyScore: 1, processScore: 1 },
  };

  it("returns 10.0 for the top of every dimension", () => {
    expect(headlineScore(topInputs)).toBe(10);
  });

  it("returns 0.0 for the bottom of every dimension", () => {
    expect(headlineScore(bottomInputs)).toBe(0);
  });

  it("treats null notes as 'weight redistributed', not 'weak notes'", () => {
    const withNullNotes: HeadlineInputs = { ...topInputs, notes: null };
    expect(headlineScore(withNullNotes)).toBe(10);

    const withWeakNotes: HeadlineInputs = {
      ...topInputs,
      notes: { awarenessScore: 1, honestyScore: 1, processScore: 1 },
    };
    expect(headlineScore(withWeakNotes)).toBeLessThan(10);
  });

  it("weights AI fingerprint at 40% — flipping it alone moves the score the most", () => {
    const onlyAiTop: HeadlineInputs = {
      zoneScore: 0,
      trapsCaught: 0,
      aiFingerprintScore: 5,
      diagnosticAvg: 1,
      notes: null,
    };
    const onlyTrapsTop: HeadlineInputs = {
      zoneScore: 0,
      trapsCaught: 3,
      aiFingerprintScore: 1,
      diagnosticAvg: 1,
      notes: null,
    };
    expect(headlineScore(onlyAiTop)).toBeGreaterThan(headlineScore(onlyTrapsTop));
  });

  it("is rounded to one decimal place", () => {
    const result = headlineScore({
      zoneScore: 2,
      trapsCaught: 1,
      aiFingerprintScore: 3,
      diagnosticAvg: 2,
      notes: { awarenessScore: 2, honestyScore: 2, processScore: 2 },
    });
    expect(result).toBe(Math.round(result * 10) / 10);
  });

  it("clamps out-of-range inputs gracefully", () => {
    // Defensive: scorer may occasionally return values outside the documented
    // range. The headline shouldn't NaN or go negative.
    const wild = headlineScore({
      zoneScore: 99,
      trapsCaught: -1,
      aiFingerprintScore: 10,
      diagnosticAvg: 5,
      notes: null,
    });
    expect(wild).toBeGreaterThanOrEqual(0);
    expect(wild).toBeLessThanOrEqual(10);
  });
});
