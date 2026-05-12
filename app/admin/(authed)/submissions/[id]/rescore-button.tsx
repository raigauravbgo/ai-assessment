"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RescoreButton({ submissionId }: { submissionId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function rescore() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/rescore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Rescore failed.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={rescore}
        disabled={busy}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      >
        {busy ? "Scoring..." : "Run scoring"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {done && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Scoring completed — refresh if it doesn&apos;t appear.
        </p>
      )}
    </div>
  );
}
