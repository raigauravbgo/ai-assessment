// Shared formatter that builds the "SOURCE FILES" block for the scoring
// prompts under a hard byte budget. Without this, large submissions (hundreds
// of files × tens of KB) easily exceed gpt-4o's 128K context window.
//
// Strategy:
//   1. `ai-chat.md` (if present, anywhere in the zip) goes first and is
//      never truncated — it's the primary evidence for the AI fingerprint
//      markers per PRD §5.4 D3.
//   2. Remaining files are appended in the order extraction surfaced them
//      (already de-noised — node_modules, __pycache__, data/ etc. were
//      stripped in lib/zip/extract.ts).
//   3. When the running total would exceed MAX_SOURCE_BUNDLE_BYTES, the
//      next file either gets head-truncated to fit, or is recorded as
//      "OMITTED" (header only) once the budget is exhausted.
//
// The scorer is told explicitly when truncation happened so it can flag
// the limitation in its summary instead of silently scoring partial data.

const MAX_SOURCE_BUNDLE_BYTES = 250 * 1024; // ~62K tokens at 4 chars/token

type SourceFile = { path: string; content: string };

function isAiChat(path: string): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  const base = lower.split("/").pop() ?? "";
  return base === "ai-chat.md";
}

export function formatSourceBundle(files: SourceFile[]): string {
  const chatFiles = files.filter((f) => isAiChat(f.path));
  const otherFiles = files.filter((f) => !isAiChat(f.path));
  const prioritized = [...chatFiles, ...otherFiles];

  const parts: string[] = [];
  let totalBytes = 0;
  let truncatedCount = 0;
  let omittedCount = 0;

  for (const f of prioritized) {
    const header = `--- ${f.path} ---\n`;
    const headerBytes = Buffer.byteLength(header, "utf8");
    const contentBytes = Buffer.byteLength(f.content, "utf8");
    const fullBytes = headerBytes + contentBytes;
    const remaining = MAX_SOURCE_BUNDLE_BYTES - totalBytes;

    // ai-chat.md is never truncated — it's primary evidence for AI fingerprint.
    if (isAiChat(f.path)) {
      parts.push(`${header}${f.content}`);
      totalBytes += fullBytes;
      continue;
    }

    if (fullBytes <= remaining) {
      parts.push(`${header}${f.content}`);
      totalBytes += fullBytes;
      continue;
    }

    // Try to fit a head-truncated version (must include header + meaningful prefix).
    const minUsefulContent = 500;
    const contentBudget = remaining - headerBytes - 200; // 200-byte buffer for truncation marker
    if (contentBudget >= minUsefulContent) {
      const truncatedContent = f.content.slice(0, contentBudget);
      parts.push(
        `--- ${f.path} (TRUNCATED to fit context budget) ---\n${truncatedContent}\n\n[file truncated]`,
      );
      totalBytes = MAX_SOURCE_BUNDLE_BYTES;
      truncatedCount++;
    } else {
      // No room even for a snippet — just record the path.
      parts.push(`--- ${f.path} (OMITTED — context budget exhausted) ---`);
      omittedCount++;
    }
  }

  if (truncatedCount > 0 || omittedCount > 0) {
    parts.push("");
    parts.push(
      `[NOTE TO SCORER: source bundle exceeded the context budget. ${truncatedCount} file(s) were head-truncated; ${omittedCount} file(s) were omitted entirely (only their paths above). You see ai-chat.md and as much source as fits. Reflect this limitation in your reasoning if it materially affects your scoring.]`,
    );
  }

  return parts.join("\n\n");
}
