// Generates a shareable Markdown report for one submission. Covers the
// rubric (so the reader understands what the scores mean), the per-dimension
// reasoning, the participant's raw input, and the admin's final decision.
// Returned as `text/markdown` with Content-Disposition so the browser saves
// it as `report-<name>-<problem>.md`.

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/config/diagnostic-questions";

type Ctx = { params: Promise<{ id: string }> };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function bucketLabel(b: string): string {
  return (
    {
      fast: "Fast multiplier",
      slow: "Slow multiplier",
      low: "Low multiplier",
    }[b] ?? b
  );
}

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const s = await prisma.submission.findUnique({
    where: { id },
    include: {
      participant: true,
      problem: true,
      cycle: true,
      score: true,
      adminDecision: true,
      diagnosticResponses: { orderBy: { questionIndex: "asc" } },
    },
  });
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const md = renderReport(s);

  const filename = `report-${slugify(s.participant.name)}-${slugify(s.problem.title)}.md`;
  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

type ReportInput = NonNullable<
  Awaited<ReturnType<typeof prisma.submission.findUnique<typeof reportInclude>>>
>;

const reportInclude = {
  where: { id: "" },
  include: {
    participant: true,
    problem: true,
    cycle: true,
    score: true,
    adminDecision: true,
    diagnosticResponses: true,
  },
} as const;

function renderReport(s: ReportInput): string {
  const score = s.score;
  const decision = s.adminDecision;
  const final = decision?.confirmedBucket ?? score?.suggestedBucket ?? null;
  const isOverride =
    decision?.confirmedBucket != null &&
    score?.suggestedBucket != null &&
    decision.confirmedBucket !== score.suggestedBucket;

  const lines: string[] = [];

  // ─── Header ─────────────────────────────────────────────────────────────
  lines.push("# AI Capability Assessment Report");
  lines.push("");
  lines.push(`**Participant:** ${s.participant.name}  `);
  lines.push(`**Role:** ${s.participant.role}  `);
  lines.push(`**Cycle:** ${s.cycle.name}  `);
  lines.push(`**Problem:** ${s.problem.title}  `);
  lines.push(`**Selected at:** ${fmt(s.selectedAt)}  `);
  lines.push(`**Submitted at:** ${fmt(s.submittedAt)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ─── Final bucket ───────────────────────────────────────────────────────
  lines.push("## Final bucket");
  lines.push("");
  if (final) {
    lines.push(`**${bucketLabel(final)}**${isOverride ? ` _(admin override of AI's suggested "${score!.suggestedBucket}")_` : ""}`);
    if (decision?.flagged) {
      lines.push("");
      lines.push("⚠️ Flagged by admin for second-opinion review.");
    }
    if (decision?.overrideNote) {
      lines.push("");
      lines.push("> **Admin note:**");
      lines.push(...decision.overrideNote.split("\n").map((l) => `> ${l}`));
    }
  } else {
    lines.push("_Not scored yet._");
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // ─── Rubric ────────────────────────────────────────────────────────────
  lines.push("## What the ratings mean");
  lines.push("");
  lines.push(
    "Participants are grouped into one of three **multiplier buckets** based on how effectively they leveraged AI to deliver. The bucketing logic is deliberately conservative — particularly for the low bucket, which requires three convergent weak signals before flagging someone as not-a-fit.",
  );
  lines.push("");
  lines.push("| Bucket | Criteria |");
  lines.push("|---|---|");
  lines.push("| **Fast multiplier** | AI fingerprint ≥4/5 **AND** ≥2 traps fully caught **AND** diagnostic forward-orientation avg >2.0 **AND** floor zone cleared. |");
  lines.push("| **Slow multiplier** | Any signal present but not consistently strong. The default for anyone not clearly fast or low. |");
  lines.push("| **Low multiplier** | AI fingerprint ≤2/5 **AND** traps mostly missed **AND** diagnostic flat — **all three required**. A single strong dimension takes someone out of this bucket. |");
  lines.push("");
  lines.push("Scoring covers **five dimensions**:");
  lines.push("");
  lines.push(
    "1. **Zone completion (0–3)** — How much of the problem was actually built? Floor (table-stakes), middle (depth), stretch (reach).",
  );
  lines.push(
    "2. **Trap handling (caught / partial / missed × 3 traps)** — Did they catch problem-specific gotchas like null handling, PII discipline, prompt injection?",
  );
  lines.push(
    "3. **AI fingerprint (1–5)** — Evidence of *AI-native judgment* — pushing back on AI output, iterating on prompts, validating where AI tends to fail. Not whether they used AI.",
  );
  lines.push(
    "4. **Notes quality (3 sub-scores 1–3, or null if no notes submitted)** — Self-awareness of AI-specific limitations, intellectual honesty about gaps, process insight beyond what code shows.",
  );
  lines.push(
    "5. **Diagnostic responses (1–3 per question)** — Three debrief questions probing forward orientation (AI-iterative thinking) vs backward (manual-fix mindset).",
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  // ─── Scoring breakdown ─────────────────────────────────────────────────
  if (!score) {
    lines.push("## Scoring breakdown");
    lines.push("");
    lines.push(
      "_Scoring has not completed for this submission. The participant's raw input is included below for reference._",
    );
    lines.push("");
  } else {
    lines.push("## Scoring breakdown");
    lines.push("");

    // Zone
    const zoneReasoning = score.zoneReasoning as { floor: string; middle: string; stretch: string } | null;
    lines.push(`### Zone completion: ${score.zoneScore}/3`);
    lines.push("");
    if (zoneReasoning) {
      lines.push(`- **Floor** ${score.zoneScore >= 1 ? "✓ cleared" : "✗ not cleared"} — ${zoneReasoning.floor}`);
      lines.push(`- **Middle** ${score.zoneScore >= 2 ? "✓ cleared" : "✗ not cleared"} — ${zoneReasoning.middle}`);
      lines.push(`- **Stretch** ${score.zoneScore >= 3 ? "✓ attempted" : "✗ not attempted"} — ${zoneReasoning.stretch}`);
    }
    lines.push("");

    // Traps
    const trapEvidence = score.trapEvidence as Array<{
      trapName: string;
      status: string;
      evidenceCitation: string;
    }>;
    lines.push("### Trap handling");
    lines.push("");
    for (const t of trapEvidence) {
      lines.push(`- **${t.trapName}** — ${t.status.toUpperCase()}`);
      lines.push(`  - Evidence: ${t.evidenceCitation}`);
    }
    lines.push("");

    // AI fingerprint
    const aiMarkers = score.aiFingerprintMarkers as Array<{
      marker: string;
      rating: number;
      codeExample: string;
    }>;
    lines.push(`### AI fingerprint: ${score.aiFingerprintScore}/5`);
    lines.push("");
    lines.push(score.aiFingerprintSummary);
    lines.push("");
    for (const m of aiMarkers) {
      lines.push(`- **${m.marker}** (${m.rating}/3): ${m.codeExample}`);
    }
    lines.push("");

    // Notes
    lines.push("### Notes quality");
    lines.push("");
    if (score.notesAwarenessScore === null) {
      lines.push(
        "_Participant did not submit notes. Per the rubric, this is recorded as null across all three sub-scores (absence is no signal) rather than zero (a weak submission)._",
      );
    } else {
      lines.push(`- **Awareness of AI-specific limitations**: ${score.notesAwarenessScore}/3`);
      lines.push(`- **Intellectual honesty about gaps**: ${score.notesHonestyScore}/3`);
      lines.push(`- **Process insight beyond what code shows**: ${score.notesProcessScore}/3`);
      if (score.notesSummary) {
        lines.push("");
        lines.push(score.notesSummary);
      }
    }
    lines.push("");

    // Diagnostic
    lines.push("### Diagnostic responses");
    lines.push("");
    lines.push(`- **Q1** (distrust + response): ${score.diagnosticQ1Score}/3`);
    lines.push(`- **Q2** (mental model — iterate vs manual): ${score.diagnosticQ2Score}/3`);
    lines.push(`- **Q3** (AI-specific vs generic risk awareness): ${score.diagnosticQ3Score}/3`);
    lines.push("");
    lines.push("> **Most revealing phrase from the participant's answers:**");
    lines.push(">");
    lines.push(`> "${score.diagnosticRevealingPhrase}"`);
    lines.push("");
    lines.push(`_Why it's revealing:_ ${score.diagnosticRevealingReason}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Bucket reasoning
    lines.push("## Why this bucket");
    lines.push("");
    lines.push(score.bucketReasoning);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // ─── Participant input ─────────────────────────────────────────────────
  lines.push("## Participant input");
  lines.push("");

  lines.push("### Notes submitted with code");
  lines.push("");
  if (s.notesText) {
    lines.push(...s.notesText.split("\n").map((l) => `> ${l}`));
  } else {
    lines.push("_(empty — no notes submitted)_");
  }
  lines.push("");

  lines.push("### Diagnostic answers");
  lines.push("");
  for (const r of s.diagnosticResponses) {
    const q = DIAGNOSTIC_QUESTIONS[r.questionIndex];
    lines.push(`**Q${r.questionIndex + 1}: ${q?.text ?? `Question ${r.questionIndex}`}**`);
    lines.push("");
    lines.push(...r.responseText.split("\n").map((l) => `> ${l}`));
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  // ─── Admin record ──────────────────────────────────────────────────────
  if (decision) {
    lines.push("## Admin record");
    lines.push("");
    if (decision.confirmedBucket) {
      lines.push(`- Confirmed bucket: **${bucketLabel(decision.confirmedBucket)}**`);
    }
    lines.push(`- Flagged for second opinion: ${decision.flagged ? "yes" : "no"}`);
    lines.push(`- Decided at: ${fmt(decision.decidedAt)}`);
    if (decision.overrideNote) {
      lines.push("");
      lines.push("Note:");
      lines.push("");
      lines.push(...decision.overrideNote.split("\n").map((l) => `> ${l}`));
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`_Generated ${fmt(new Date())} — BGO AI Capability Assessment Platform._`);
  lines.push("");

  return lines.join("\n");
}
