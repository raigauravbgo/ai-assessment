// Submission zip storage. Filesystem implementation — dev defaults to `./uploads`,
// production sets `UPLOADS_DIR=/data/uploads` and mounts a Railway Volume there
// so files survive container restarts. Swap to S3 if scale demands it; the
// orchestrator only reads via `loadZip(zipPath)` so the call sites don't change.

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const UPLOAD_DIR = process.env.UPLOADS_DIR ?? "uploads";

function safePath(submissionId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(submissionId)) {
    throw new Error(`unsafe submissionId: ${submissionId}`);
  }
  return join(UPLOAD_DIR, `${submissionId}.zip`);
}

export async function saveZip(
  submissionId: string,
  bytes: Buffer,
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const path = safePath(submissionId);
  await writeFile(resolve(path), bytes);
  return path;
}

export async function loadZip(zipPath: string): Promise<Buffer> {
  return readFile(resolve(zipPath));
}

export async function zipExists(zipPath: string): Promise<boolean> {
  try {
    await stat(resolve(zipPath));
    return true;
  } catch {
    return false;
  }
}
