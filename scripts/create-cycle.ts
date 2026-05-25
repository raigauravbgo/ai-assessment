// Admin CLI: create an AssessmentCycle.
// Usage: npm run cycle:new -- --name "Engineering hackathon" --role engineering --hours 48
//
// Problem IDs default to all problems with the matching role. Override with --problems id1,id2,id3.

import { prisma } from "@/lib/db";

type Args = {
  name?: string;
  role?: string;
  hours?: number;
  problems?: string[];
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") out.name = argv[++i];
    else if (a === "--role") out.role = argv[++i];
    else if (a === "--hours") out.hours = Number(argv[++i]);
    else if (a === "--problems") out.problems = argv[++i].split(",");
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.name ?? `Cycle ${new Date().toISOString().slice(0, 10)}`;
  const role = args.role ?? "engineering";
  // Cycle window is the *enrollment* period, distinct from the per-participant
  // 48h work timer that starts when they pick a problem. Default 1 week so the
  // pilot doesn't expire under participants who join late.
  const hours = args.hours ?? 168;

  let problemIds = args.problems;
  if (!problemIds) {
    const problems = await prisma.problem.findMany({ where: { role } });
    problemIds = problems.map((p) => p.id);
    if (problemIds.length === 0) {
      throw new Error(
        `no problems found for role "${role}". Did you run \`npm run db:seed\`?`,
      );
    }
  }

  const windowStart = new Date();
  const windowEnd = new Date(windowStart.getTime() + hours * 60 * 60 * 1000);

  const cycle = await prisma.assessmentCycle.create({
    data: {
      name,
      role,
      problemIds,
      windowStart,
      windowEnd,
    },
  });

  console.log(`Cycle created`);
  console.log(`  id      ${cycle.id}`);
  console.log(`  name    ${cycle.name}`);
  console.log(`  role    ${cycle.role}`);
  console.log(`  window  ${cycle.windowStart.toISOString()} → ${cycle.windowEnd.toISOString()}`);
  console.log(`  problems ${cycle.problemIds.join(", ")}`);
  console.log(``);
  console.log(`Next: create a participant in this cycle:`);
  console.log(`  npm run participant:new -- --name "Jane Doe" --cycle ${cycle.id}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
