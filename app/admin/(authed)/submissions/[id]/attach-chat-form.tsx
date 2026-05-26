"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AttachChatForm({ submissionId }: { submissionId: string }) {
  const [chatText, setChatText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (chatText.trim().length === 0) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/attach-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId, chatText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          `Attach failed (${res.status}): ${body.error ?? res.statusText}${body.message ? "\n" + body.message : ""}`,
        );
        return;
      }
      setDone(true);
      setChatText("");
      router.refresh();
    } catch (err) {
      setError(`Attach failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={chatText}
        onChange={(e) => setChatText(e.target.value)}
        rows={10}
        placeholder="Paste the participant's AI chat (Markdown). Replaces ai-chat.md in their zip and re-runs scoring."
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Use this when a participant emails their AI chat separately rather than including <code>ai-chat.md</code> in their zip. The attached content overrides any existing <code>ai-chat.md</code> and triggers an immediate rescore (~15-30s).
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || chatText.trim().length === 0}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {busy ? "Attaching + rescoring..." : "Attach chat & rescore"}
        </button>
        {done && (
          <span className="text-sm text-emerald-700 dark:text-emerald-300">
            Done — scroll up to see refreshed dimension cards.
          </span>
        )}
      </div>
      {error && (
        <pre className="whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </pre>
      )}
    </form>
  );
}
