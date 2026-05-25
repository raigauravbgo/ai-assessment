import { prisma } from "@/lib/db";

async function main() {
  const now = new Date();
  console.log(`Server "now": ${now.toISOString()}\n`);

  const cycles = await prisma.assessmentCycle.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const c of cycles) {
    const expired = c.windowEnd <= now;
    const hoursLeft = (c.windowEnd.getTime() - now.getTime()) / 3_600_000;
    console.log(`  ${c.id} — ${c.name}`);
    console.log(`    role:   ${c.role}`);
    console.log(`    window: ${c.windowStart.toISOString()} → ${c.windowEnd.toISOString()}`);
    console.log(`    state:  ${expired ? "EXPIRED" : "active"} (${hoursLeft.toFixed(1)}h ${expired ? "ago" : "remaining"})`);
    console.log("");
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
