// Quick read-only check that the smoke test left the DB in the expected state.
import { prisma } from "@/lib/db";

async function main() {
  const subs = await prisma.submission.findMany({
    include: {
      participant: true,
      problem: true,
      diagnosticResponses: { orderBy: { questionIndex: "asc" } },
      score: true,
    },
    orderBy: { selectedAt: "desc" },
    take: 5,
  });

  for (const s of subs) {
    console.log(`---`);
    console.log(`Submission ${s.id}`);
    console.log(`  participant   ${s.participant.name} (${s.participant.id})`);
    console.log(`  problem       ${s.problem.title} (${s.problemId})`);
    console.log(`  status        ${s.status}`);
    console.log(`  selectedAt    ${s.selectedAt.toISOString()}`);
    console.log(`  submittedAt   ${s.submittedAt?.toISOString() ?? "—"}`);
    console.log(`  zipPath       ${s.zipPath ?? "—"}`);
    console.log(`  notesText     ${s.notesText ?? "—"}`);
    console.log(`  diagnostics   ${s.diagnosticResponses.length}/3`);
    for (const d of s.diagnosticResponses) {
      console.log(`    Q${d.questionIndex}: ${d.responseText.slice(0, 60)}`);
    }
    console.log(`  score         ${s.score ? `bucket=${s.score.suggestedBucket}` : "not scored"}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
