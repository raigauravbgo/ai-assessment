// Attach (or replace) ai-chat.md inside a participant's submitted zip, then
// retrigger scoring. For the case where a participant submitted their zip
// without including their AI chat history and sent it separately afterward.

import { NextResponse } from "next/server";
import { z } from "zod";
import AdmZip from "adm-zip";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { loadZip, saveZip } from "@/lib/zip/storage";
import { scoreSubmission } from "@/lib/scoring/orchestrate";

const bodySchema = z.object({
  submissionId: z.string().min(1),
  chatText: z.string().min(1).max(500_000),
});

// Per the zip extraction limits in lib/zip/extract.ts — text files are capped
// at 200 KB before they're passed to the scorer. We allow up to ~500 KB on
// input so admins can paste long chats and let the extraction step truncate
// gracefully, instead of bouncing the upload outright.

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
    const submission = await prisma.submission.findUnique({
      where: { id: parsed.data.submissionId },
    });
    if (!submission) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!submission.zipPath) {
      return NextResponse.json(
        { error: "submission has no zip yet — cannot attach chat" },
        { status: 400 },
      );
    }

    // Load the zip, remove any existing ai-chat.md (root or anywhere), add the
    // new content at the root, save back to the same path.
    const buf = await loadZip(submission.zipPath);
    const zip = new AdmZip(buf);

    for (const entry of zip.getEntries()) {
      const name = entry.entryName.toLowerCase().replace(/\\/g, "/");
      const base = name.split("/").pop() ?? "";
      if (base === "ai-chat.md") {
        zip.deleteFile(entry);
      }
    }
    zip.addFile("ai-chat.md", Buffer.from(parsed.data.chatText, "utf8"));

    await saveZip(submission.id, zip.toBuffer());

    // Re-run scoring synchronously so the admin sees the updated bucket
    // immediately. Errors surface to the admin instead of being silently logged.
    const result = await scoreSubmission(submission.id);
    return NextResponse.json({
      ok: true,
      scoreId: result.scoreId,
      bucket: result.bucket,
    });
  } catch (err) {
    console.error("/api/admin/attach-chat failed:", err);
    return NextResponse.json(
      {
        error: "attach_failed",
        message: (err as Error).message ?? String(err),
      },
      { status: 500 },
    );
  }
}
