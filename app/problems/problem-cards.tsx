"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Problem = {
  id: string;
  title: string;
  description: string;
};

export function ProblemCards({ problems }: { problems: Problem[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onPick(problemId: string) {
    if (busyId) return;
    if (!confirm("Picking this problem locks your choice and starts the 48-hour timer. Continue?")) return;

    setBusyId(problemId);
    setError(null);
    try {
      const res = await fetch("/api/participant/select-problem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't lock your selection. Try again.");
        return;
      }
      router.push("/submit");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {problems.map((p) => (
        <article
          key={p.id}
          className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {p.title}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {p.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onPick(p.id)}
              disabled={busyId !== null}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {busyId === p.id ? "Locking..." : "Pick this one"}
            </button>
            <a
              href={`/fixtures/${p.id}.zip`}
              download
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-600"
            >
              Preview starter data ↓
            </a>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Downloading the starter data does <em>not</em> lock your choice. Read all three first, then pick.
          </p>
        </article>
      ))}
    </div>
  );
}
