"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0h 00m 00s — time elapsed";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

export function SubmitForm({ deadlineAtIso }: { deadlineAtIso: string }) {
  const deadlineAt = new Date(deadlineAtIso).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = deadlineAt - now;
  const expired = remaining <= 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pick a zip file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("zip", file);
      form.append("notes", notes);
      const res = await fetch("/api/participant/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Upload failed. Try again.");
        return;
      }
      router.push("/diagnostic");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <div
        className={`rounded-md border p-3 text-sm font-mono ${
          expired
            ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
            : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        }`}
      >
        Time remaining: {formatRemaining(remaining)}
      </div>

      <div>
        <label
          htmlFor="zip"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Your project, zipped
        </label>
        <input
          ref={fileRef}
          id="zip"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          required
          className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Max 50 MB, 500 files. Skip <code>node_modules</code>, <code>.git</code>, build output.
        </p>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Anything you want us to know about your submission? (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="What worked, what didn't, what you'd change with more time — whatever's useful."
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || expired}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {submitting ? "Uploading..." : "Submit"}
      </button>
    </form>
  );
}
