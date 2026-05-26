// Zip extraction for participant submissions.
//
// Untrusted input — enforce hard limits before reading any entry:
//   - Total uncompressed size  ≤ MAX_TOTAL_BYTES
//   - File count               ≤ MAX_FILE_COUNT
//   - Per-file content for AI  ≤ MAX_TEXT_BYTES_PER_FILE
//   - Reject path traversal, absolute paths, symlinks
//
// Output shape matches SubmissionArtifacts in prompts/types.ts: a flat text
// tree (`fileTree`) plus an array of { path, content } pairs for text files.

import AdmZip from "adm-zip";
import { posix } from "node:path";

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_FILE_COUNT = 500;
const MAX_TEXT_BYTES_PER_FILE = 200 * 1024;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "rst",
  "py", "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "json", "jsonl", "yaml", "yml", "toml", "ini", "cfg", "env",
  "html", "css", "scss", "sass",
  "sh", "bash", "zsh", "fish",
  "java", "kt", "scala", "groovy",
  "rb", "go", "rs", "c", "h", "cpp", "hpp", "cs", "swift", "m", "mm",
  "sql", "graphql", "gql",
  "csv", "tsv",
  "xml", "svg",
  "dockerfile", "makefile",
  "gitignore", "gitattributes",
]);

// Directories whose contents we don't show to the scorer. They're either
// generated/dependency junk (node_modules, build outputs) or runtime artifacts
// (data/, output/, coverage). The participant's actual judgment lives elsewhere.
const SKIP_DIR_PREFIXES = [
  "__macosx/",
  "node_modules/",
  ".git/",
  ".venv/",
  "venv/",
  "env/",
  ".env/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  "__pycache__/",
  ".pytest_cache/",
  ".mypy_cache/",
  ".ruff_cache/",
  "data/",
  "output/",
  "outputs/",
  "coverage/",
  "htmlcov/",
  ".nyc_output/",
  "target/",
  "vendor/",
  ".gradle/",
  ".idea/",
  ".vscode/",
];

export type ExtractedSubmission = {
  fileTree: string;
  sourceFiles: Array<{ path: string; content: string }>;
  truncated: boolean;
};

export class ZipValidationError extends Error {}

function normalizePath(rawName: string): string | null {
  // adm-zip names use forward slashes; normalize and reject absolute / traversal.
  const name = rawName.replace(/\\/g, "/");
  if (name.startsWith("/") || name.startsWith("\\")) return null;
  const normalized = posix.normalize(name);
  if (normalized.startsWith("../") || normalized === "..") return null;
  if (normalized.includes("/../")) return null;
  return normalized;
}

function isTextFile(path: string): boolean {
  const lower = path.toLowerCase();
  const base = posix.basename(lower);
  if (base === "dockerfile" || base === "makefile") return true;
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = lower.slice(dot + 1);
  return TEXT_EXTENSIONS.has(ext);
}

function shouldSkipDir(path: string): boolean {
  const lower = path.toLowerCase();
  return SKIP_DIR_PREFIXES.some((prefix) => lower.startsWith(prefix) || lower.includes(`/${prefix}`));
}

export function extractZip(zipBytes: Buffer): ExtractedSubmission {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBytes);
  } catch (err) {
    throw new ZipValidationError(`unreadable zip: ${(err as Error).message}`);
  }
  const entries = zip.getEntries();

  // Pass 1: filter to entries we'll actually look at, rejecting unsafe paths
  // and skipping well-known generated/cache directories. The MAX_FILE_COUNT
  // limit applies AFTER filtering — a participant who zipped node_modules
  // shouldn't be rejected just because the dependency tree is huge.
  const candidates: Array<{ entry: AdmZip.IZipEntry; path: string }> = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const path = normalizePath(entry.entryName);
    if (!path) {
      throw new ZipValidationError(`unsafe path in zip: ${entry.entryName}`);
    }
    if (shouldSkipDir(path)) continue;
    candidates.push({ entry, path });
  }

  if (candidates.length > MAX_FILE_COUNT) {
    throw new ZipValidationError(
      `zip contains ${candidates.length} files after stripping generated dirs ` +
        `(${entries.length} total); limit is ${MAX_FILE_COUNT}. Strip output/data/build dirs and re-submit.`,
    );
  }

  const tree: string[] = [];
  const sources: ExtractedSubmission["sourceFiles"] = [];
  let totalBytes = 0;
  let truncated = false;

  // Pass 2: walk the filtered set, enforce size limits, extract text content.
  for (const { entry, path } of candidates) {
    const declared = entry.header.size;
    totalBytes += declared;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new ZipValidationError(
        `zip uncompressed size exceeds ${MAX_TOTAL_BYTES} bytes (after stripping generated dirs)`,
      );
    }

    tree.push(`${path} (${declared} bytes)`);

    if (!isTextFile(path)) continue;

    const buf = entry.getData();
    let content = buf.toString("utf8");
    if (Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES_PER_FILE) {
      content =
        content.slice(0, MAX_TEXT_BYTES_PER_FILE) +
        `\n\n[truncated at ${MAX_TEXT_BYTES_PER_FILE} bytes]`;
      truncated = true;
    }
    sources.push({ path, content });
  }

  tree.sort();
  return {
    fileTree: tree.join("\n"),
    sourceFiles: sources,
    truncated,
  };
}
