import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().min(1).max(50),
  hours: z.number().int().min(1).max(336),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Default the cycle's problem set to every Problem matching its role.
  const problems = await prisma.problem.findMany({
    where: { role: parsed.data.role },
  });
  if (problems.length === 0) {
    return NextResponse.json(
      { error: `no problems exist for role "${parsed.data.role}"; run db:seed first` },
      { status: 400 },
    );
  }

  const windowStart = new Date();
  const windowEnd = new Date(windowStart.getTime() + parsed.data.hours * 60 * 60 * 1000);

  const cycle = await prisma.assessmentCycle.create({
    data: {
      name: parsed.data.name,
      role: parsed.data.role,
      problemIds: problems.map((p) => p.id),
      windowStart,
      windowEnd,
    },
  });

  return NextResponse.json({ ok: true, cycle });
}
