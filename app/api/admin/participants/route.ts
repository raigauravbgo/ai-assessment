import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(50),
  cycleId: z.string().min(1),
});

function generateToken(): string {
  // 16 chars of URL-safe base64 → ~96 bits of entropy.
  return randomBytes(12).toString("base64url");
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const cycle = await prisma.assessmentCycle.findUnique({
    where: { id: parsed.data.cycleId },
  });
  if (!cycle) {
    return NextResponse.json({ error: "cycle_not_found" }, { status: 404 });
  }
  if (cycle.role !== parsed.data.role) {
    return NextResponse.json(
      { error: `cycle role "${cycle.role}" does not match participant role "${parsed.data.role}"` },
      { status: 400 },
    );
  }

  const participant = await prisma.participant.create({
    data: {
      name: parsed.data.name,
      token: generateToken(),
      role: parsed.data.role,
    },
  });

  return NextResponse.json({ ok: true, participant });
}
