// Manually trigger scoring for the most recent submission. Surfaces the actual
// error from the orchestrator (the Run scoring button in the admin UI returns
// a generic "scoring_failed" message; this script shows the real stack).
//
// Usage: npx tsx --env-file=.env --env-file=.env.local scripts/score-one.ts

import { prisma } from "@/lib/db";
import { scoreSubmission } from "@/lib/scoring/orchestrate";

async function main() {
  const submission = await prisma.submission.findFirst({
    orderBy: { selectedAt: "desc" },
  });
  if (!submission) {
    console.error("No submission found");
    process.exit(1);
  }
  console.log(`Scoring submission ${submission.id}...`);
  console.log(`  baseUrl: ${process.env.SCORING_BASE_URL ?? "(default)"}`);
  console.log(`  model:   ${process.env.SCORING_MODEL ?? "(default)"}`);
  console.log(`  key set: ${Boolean(process.env.SCORING_API_KEY)}`);
  console.log("");

  const result = await scoreSubmission(submission.id);
  console.log(`\nDone. Score ${result.scoreId} created; bucket = ${result.bucket}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nFAILED:");
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
