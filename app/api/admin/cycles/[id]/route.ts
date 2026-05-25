import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// DELETE a cycle and all submissions in it. Participants are NOT deleted
// (they may belong to other cycles by role). Use the participant-delete
// endpoint separately if you want to remove the people too.
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const cycle = await prisma.assessmentCycle.findUnique({ where: { id } });
  if (!cycle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const subs = await tx.submission.findMany({
      where: { cycleId: id },
      select: { id: true },
    });
    for (const s of subs) {
      await tx.adminDecision.deleteMany({ where: { submissionId: s.id } });
    }
    await tx.submission.deleteMany({ where: { cycleId: id } });
    await tx.assessmentCycle.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
