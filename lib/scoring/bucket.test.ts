import { describe, expect, it } from "vitest";
import { bucketSuggestion, type BucketInputs } from "./bucket";

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
