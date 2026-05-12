import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { resolveFlowState } from "@/lib/auth/flow";
import { prisma } from "@/lib/db";
import { saveZip } from "@/lib/zip/storage";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const participant = await getCurrentParticipant();
  if (!participant) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const flow = await resolveFlowState(participant);
  if (flow.stage !== "upload") {
    return NextResponse.json(
      { error: "not_in_upload_stage", stage: flow.stage },
      { status: 409 },
    );
  }

  if (flow.deadlineAt.getTime() <= Date.now()) {
    await prisma.submission.update({
      where: { id: flow.submissionId },
      data: { status: "expired" },
    });
    return NextResponse.json({ error: "window_expired" }, { status: 410 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const file = form.get("zip");
  const notes = (form.get("notes") ?? "").toString();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_zip" }, { status: 400 });
  }
  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json({ error: "zip_too_large" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const zipPath = await saveZip(flow.submissionId, buf);

  await prisma.submission.update({
    where: { id: flow.submissionId },
    data: {
      zipPath,
      notesText: notes.trim() === "" ? null : notes,
      submittedAt: new Date(),
      status: "submitted",
    },
  });

  return NextResponse.json({ ok: true });
}
