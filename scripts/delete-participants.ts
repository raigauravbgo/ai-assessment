// Delete a set of participants and all their related data.
// Usage: npx tsx scripts/delete-participants.ts <id1> [id2] [id3] ...

import { prisma } from "@/lib/db";

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error("Usage: npx tsx scripts/delete-participants.ts <id1> [id2] ...");
    process.exit(1);
  }

  for (const id of ids) {
    const p = await prisma.participant.findUnique({
      where: { id },
      include: { submissions: { select: { id: true, status: true } } },
    });
    if (!p) {
      console.warn(`  ${id}: not found, skipping`);
      continue;
    }

    // Delete in dependency order:
    //   AdminDecision → Submission (no cascade)
    //   Score → Submission (cascades on submission delete)
    //   DiagnosticResponse → Submission (cascades on submission delete)
    //   Submission → Participant (no cascade)
    //   LearningCompletion → Participant (no cascade)
    await prisma.$transaction(async (tx) => {
      for (const sub of p.submissions) {
        await tx.adminDecision.deleteMany({ where: { submissionId: sub.id } });
      }
      await tx.submission.deleteMany({ where: { participantId: id } });
      await tx.learningCompletion.deleteMany({ where: { participantId: id } });
      await tx.participant.delete({ where: { id } });
    });
    console.log(`  deleted ${p.name} (${id})${p.submissions.length ? ` + ${p.submissions.length} submission(s)` : ""}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
