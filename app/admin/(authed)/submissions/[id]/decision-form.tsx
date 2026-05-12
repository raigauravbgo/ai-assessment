"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Bucket = "fast" | "slow" | "low";
type Existing = {
  confirmedBucket: string | null;
  overrideNote: string | null;
  flagged: boolean;
} | null;

export function DecisionForm({
  submissionId,
  suggestedBucket,
  existing,
}: {
  submissionId: string;
  suggestedBucket: string;
  existing: Existing;
}) {
  const [bucket, setBucket] = useState<Bucket>(
    (existing?.confirmedBucket as Bucket | null) ?? (suggestedBucket as Bucket),
  );
  const [note, setNote] = useState(existing?.overrideNote ?? "");
  const [flagged, setFlagged] = useState(existing?.flagged ?? false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const overriding = bucket !== suggestedBucket;
  const noteRequired = overriding;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (noteRequired && note.trim().length === 0) {
      setError("Add a note explaining the override.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/admin/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionId,
          confirmedBucket: bucket,
          overrideNote: note.trim() === "" ? null : note,
          flagged,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Confirm or override
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["fast", "slow", "low"] as Bucket[]).map((b) => (
            <label key={b} className="cursor-pointer">
              <input
                type="radio"
                name="bucket"
                value={b}
                checked={bucket === b}
                onChange={() => setBucket(b)}
                className="peer sr-only"
              />
              <span
                className={`inline-block rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  bucket === b
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                {b}
                {suggestedBucket === b && (
                  <span className="ml-1 text-xs opacity-60">(AI)</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="note"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Note {overriding && <span className="text-red-600 dark:text-red-400">(required for overrides)</span>}
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder={
            overriding
              ? "Why this differs from the AI suggestion..."
              : "Optional: anything worth recording."
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="flagged"
          type="checkbox"
          checked={flagged}
          onChange={(e) => setFlagged(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
        />
        <label htmlFor="flagged" className="text-sm text-zinc-700 dark:text-zinc-300">
          Flag for a second opinion
        </label>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving..." : existing ? "Update decision" : "Record decision"}
      </button>
    </form>
  );
}
