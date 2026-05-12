// Admin CLI: create a Participant + print their token URL.
// Usage: npm run participant:new -- --name "Jane Doe" --cycle <cycleId> [--role engineering]
//
// The cycle is required so we can ensure the participant's role matches a cycle.
// If --cycle is omitted, the most recently created active cycle for the role is used.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

type Args = {
  name?: string;
  role?: string;
  cycleId?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") out.name = argv[++i];
    else if (a === "--role") out.role = argv[++i];
    else if (a === "--cycle") out.cycleId = argv[++i];
  }
  return out;
}

function generateToken(): string {
  // 16 chars of url-safe base64 → ~96 bits of entropy. Enough for token-as-secret.
  return randomBytes(12).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name) {
    throw new Error(
      `--name is required.\nUsage: npm run participant:new -- --name "Jane Doe" --cycle <cycleId>`,
    );
  }
  const role = args.role ?? "engineering";

  let cycleId = args.cycleId;
  if (!cycleId) {
    const cycle = await prisma.assessmentCycle.findFirst({
      where: { role, windowEnd: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!cycle) {
      throw new Error(
        `no active cycle for role "${role}". Create one first with \`npm run cycle:new -- --role ${role}\`.`,
      );
    }
    cycleId = cycle.id;
    console.log(`Using most recent active cycle: ${cycle.name} (${cycle.id})`);
  }

  const token = generateToken();
  const participant = await prisma.participant.create({
    data: {
      name: args.name,
      token,
      role,
    },
  });

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/?token=${token}`;

  console.log(`Participant created`);
  console.log(`  id      ${participant.id}`);
  console.log(`  name    ${participant.name}`);
  console.log(`  role    ${participant.role}`);
  console.log(`  cycle   ${cycleId}`);
  console.log(`  token   ${token}`);
  console.log(``);
  console.log(`Send this URL to the participant:`);
  console.log(`  ${url}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
