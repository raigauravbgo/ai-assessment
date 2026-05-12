"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Q = { index: number; text: string };

export function DiagnosticChat({
  questions,
  initialIndex,
}: {
  questions: Q[];
  initialIndex: number;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (current >= questions.length) {
    return (
      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        All done. Redirecting...
      </p>
    );
  }

  const q = questions[current];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (answer.trim().length === 0) {
      setError("Add something — even a sentence is fine.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/participant/diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionIndex: q.index, responseText: answer }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save your answer. Try again.");
        return;
      }
      const body = await res.json();
      if (body.done) {
        router.push("/done");
        router.refresh();
      } else {
        setCurrent((c) => c + 1);
        setAnswer("");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Question {current + 1} of {questions.length}
      </p>
      <p className="text-base text-zinc-900 dark:text-zinc-50">{q.text}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={5}
        autoFocus
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        placeholder="Your answer..."
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || !answer.trim()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {submitting ? "Saving..." : current === questions.length - 1 ? "Submit" : "Next"}
      </button>
    </form>
  );
}
