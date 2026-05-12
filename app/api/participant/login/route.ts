import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateParticipant } from "@/lib/auth/participant";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  token: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const participant = await authenticateParticipant(parsed.data);
  if (!participant) {
    // PRD §5.1: don't reveal whether the failure was bad token vs name mismatch.
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, participantId: participant.id });
}
