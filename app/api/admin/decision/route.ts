import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  submissionId: z.string().min(1),
  confirmedBucket: z.enum(["fast", "slow", "low"]).nullable(),
  overrideNote: z.string().max(2000).nullable(),
  flagged: z.boolean(),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const submission = await prisma.submission.findUnique({
    where: { id: parsed.data.submissionId },
    include: { score: true },
  });
  if (!submission) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // PRD §5.5: all overrides are logged. An override means confirmedBucket
  // differs from the AI's suggestedBucket — surface it in the row so the
  // admin's audit view can filter on it.
  const decision = await prisma.adminDecision.upsert({
    where: { submissionId: parsed.data.submissionId },
    create: {
      submissionId: parsed.data.submissionId,
      confirmedBucket: parsed.data.confirmedBucket,
      overrideNote: parsed.data.overrideNote,
      flagged: parsed.data.flagged,
    },
    update: {
      confirmedBucket: parsed.data.confirmedBucket,
      overrideNote: parsed.data.overrideNote,
      flagged: parsed.data.flagged,
      decidedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, decision });
}
