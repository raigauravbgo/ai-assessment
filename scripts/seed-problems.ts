import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { prisma } from "../lib/db";

// Schema mirrors PRD §5.2 + the Problem model in prisma/schema.prisma.
// Source of truth is PROBLEMS.md; the JSON files are kept in sync manually for now.
const problemSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  zoneCriteria: z.object({
    floor: z.string().min(1),
    middle: z.string().min(1),
    stretch: z.string().min(1),
  }),
  trapDefinitions: z
    .array(
      z.object({
        name: z.string().min(1),
        caughtLooksLike: z.string().min(1),
        missedLooksLike: z.string().min(1),
      }),
    )
    .length(3, "each problem must define exactly 3 traps (PRD §5.2)"),
  ambiguousRequirement: z.string().min(1),
  messyDataSpec: z.string().min(1),
  hiddenConstraint: z.string().min(1),
});

async function main(): Promise<void> {
  const problemsDir = join(process.cwd(), "problems");
  const files = (await readdir(problemsDir)).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    throw new Error(`No problem files found in ${problemsDir}`);
  }

  for (const file of files) {
    const raw = await readFile(join(problemsDir, file), "utf8");
    const parsed = problemSchema.parse(JSON.parse(raw));

    await prisma.problem.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        role: parsed.role,
        title: parsed.title,
        description: parsed.description,
        zoneCriteria: parsed.zoneCriteria,
        trapDefinitions: parsed.trapDefinitions,
        ambiguousRequirement: parsed.ambiguousRequirement,
        messyDataSpec: parsed.messyDataSpec,
        hiddenConstraint: parsed.hiddenConstraint,
      },
      update: {
        role: parsed.role,
        title: parsed.title,
        description: parsed.description,
        zoneCriteria: parsed.zoneCriteria,
        trapDefinitions: parsed.trapDefinitions,
        ambiguousRequirement: parsed.ambiguousRequirement,
        messyDataSpec: parsed.messyDataSpec,
        hiddenConstraint: parsed.hiddenConstraint,
      },
    });

    console.log(`upserted ${parsed.id} — ${parsed.title}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
