import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// DELETE a participant and ALL their related data.
// Cascade order: AdminDecision → Score (cascade) + DiagnosticResponse (cascade)
// → Submission → LearningCompletion → Participant.
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const participant = await prisma.participant.findUnique({ where: { id } });
  if (!participant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const subs = await tx.submission.findMany({
      where: { participantId: id },
      select: { id: true },
    });
    for (const s of subs) {
      await tx.adminDecision.deleteMany({ where: { submissionId: s.id } });
    }
    await tx.submission.deleteMany({ where: { participantId: id } });
    await tx.learningCompletion.deleteMany({ where: { participantId: id } });
    await tx.participant.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
