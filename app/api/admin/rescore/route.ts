import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/admin";
import { scoreSubmission } from "@/lib/scoring/orchestrate";

const bodySchema = z.object({
  submissionId: z.string().min(1),
});

// Synchronous rescore (admin is waiting on it). Errors are returned to the
// admin UI; the participant-facing path already used fire-and-forget on the
// initial scoring trigger.
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    const result = await scoreSubmission(parsed.data.submissionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error(`/api/admin/rescore failed:`, err);
    return NextResponse.json(
      { error: "scoring_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}
