import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAdmin } from "@/lib/auth/admin";

const bodySchema = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const ok = await authenticateAdmin(parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
