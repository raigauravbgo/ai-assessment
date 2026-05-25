import { prisma } from "@/lib/db";

async function main() {
  const ps = await prisma.participant.findMany({
    include: {
      submissions: {
        include: { diagnosticResponses: { select: { id: true } }, score: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`${ps.length} participants:\n`);
  for (const p of ps) {
    const sub = p.submissions[0];
    console.log(`  ${p.id}`);
    console.log(`    name: ${p.name} (${p.role})`);
    console.log(`    submissions: ${p.submissions.length}${sub ? ` — status=${sub.status}, diagnostics=${sub.diagnosticResponses.length}, scored=${sub.score ? "yes" : "no"}` : ""}`);
    console.log("");
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
